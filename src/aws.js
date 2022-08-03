import {
  StartPipelineExecutionCommand,
  GetPipelineExecutionCommand,
  PipelineExecutionStatus,
  ListPipelineExecutionsCommand,
} from "@aws-sdk/client-codepipeline";

/**
 * @typedef {"info"|"error"|"warning","debug"} LoggerLevel
 */

/**
 * @typedef {function(data: any, level: LoggerLevel): void} LoggerFunction
 */

/**
 * Triggers a CodePipeline by name
 *
 * @param {import("@aws-sdk/client-codepipeline").CodePipelineClient} client
 * @param {string} pipelineName
 * @returns {Promise<string>}
 */
export async function pipelineTrigger(client, pipelineName) {
  const { pipelineExecutionId } = await client.send(
    new StartPipelineExecutionCommand({ name: pipelineName }),
  );

  if (!pipelineExecutionId) {
    throw Error("No Execution ID");
  }

  return pipelineExecutionId;
}

/**
 * Fetch pipeline run with executionId and monitor progress
 *
 * @param {import("@aws-sdk/client-codepipeline").CodePipelineClient} client
 * @param {string} pipelineName
 * @param {string} pipelineExecutionId
 * @param {LoggerFunction} logger
 * @param {number} [progressTick]
 * @returns {Promise<boolean>}
 */
export async function pipelineMonitor(
  client,
  pipelineName,
  pipelineExecutionId,
  logger,
  progressTick = 0,
) {
  await new Promise((resolve) => {
    // give AWS some time to start up the pipeline
    setTimeout(resolve, 20 * 1000);
  });

  const command = new GetPipelineExecutionCommand({
    pipelineName,
    pipelineExecutionId,
  });

  try {
    const { pipelineExecution } = await client.send(command);

    if (pipelineExecution === undefined || !pipelineExecution.status) {
      logger("pipeline: unable to fetch status", "error");
      return false;
    }

    switch (pipelineExecution.status) {
      case PipelineExecutionStatus.InProgress: {
        await logger(`pipeline: running${".".repeat(progressTick)}`, "info");
        return await pipelineMonitor(
          client,
          pipelineName,
          pipelineExecutionId,
          logger,
          ++progressTick,
        );
      }
      case PipelineExecutionStatus.Cancelled: {
        await logger(
          "pipeline: canceled. Trying to get new execution ID.",
          "info",
        );
        const newExecutionId = await pipelineGetNewestExecutionId(
          client,
          pipelineName,
        );
        await logger(
          `pipeline: waiting for new executionId: '${newExecutionId}'`,
          "info",
        );
        return await pipelineMonitor(
          client,
          pipelineName,
          newExecutionId,
          logger,
        );
      }

      case PipelineExecutionStatus.Succeeded:
        await logger("pipeline: succeeded", "info");
        return true;
      case PipelineExecutionStatus.Superseded:
        await logger(
          "pipeline: superseded. Skip rest of the execution",
          "warning",
        );
        return true;
      case PipelineExecutionStatus.Failed:
        await logger("pipeline: failed", "error");
        return false;
      case PipelineExecutionStatus.Stopping || PipelineExecutionStatus.Stopped:
        await logger("pipeline: stopped", "error");
        return false;
      default:
        await logger(
          `Unexpected pipeline status: ${pipelineExecution.status}`,
          "error",
        );
        return false;
    }
  } catch (error) {
    await logger(
      `An error occurred while getting the status of pipeline '${pipelineName}' execution: '${pipelineExecutionId}'.`,
      "error",
    );
    throw error;
  }
}

/**
 * Resolved the latest/newest executionId for a given pipeline
 *
 * @param {import("@aws-sdk/client-codepipeline").CodePipelineClient} client
 * @param {string} pipelineName
 * @returns {Promise<string>}
 */
export async function pipelineGetNewestExecutionId(client, pipelineName) {
  const command = new ListPipelineExecutionsCommand({
    pipelineName,
    maxResults: 1,
  });

  const { pipelineExecutionSummaries } = await client.send(command);
  if (pipelineExecutionSummaries && pipelineExecutionSummaries.length > 0) {
    const executionId = pipelineExecutionSummaries[0].pipelineExecutionId;

    if (!executionId) {
      throw new Error(
        `Newest pipeline execution of '${pipelineName}' has no ID`,
      );
    }

    return executionId;
  }

  throw new Error("No Pipeline executions found");
}
