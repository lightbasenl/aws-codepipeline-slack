import * as core from "@actions/core";
import { CodePipelineClient } from "@aws-sdk/client-codepipeline";
import { pipelineTrigger, pipelineMonitor } from "./aws.js";
import {
  slackCredentialsValidate,
  slackMessageCreate,
  slackMessageUpdate,
} from "./slack.js";

try {
  const slack = { color: "#c6c6c6", messages: {} };
  const client = new CodePipelineClient({});

  const slackToken = core.getInput("slack_token");
  core.debug(`slack_token: '${slackToken}'`);
  const slackChannel = core.getInput("slack_channel");
  core.debug(`slack_channel: '${slackChannel}'`);

  if (slackToken && !slackChannel) {
    core.setFailed("When slack_token is set, slack_channel should also exist.");
  }

  if (slackToken) {
    await slackCredentialsValidate(slackToken, slackChannel);
    core.info(`[slack] credentials are okay`);
  }

  // input CodePipeline
  const pipelineName = core.getInput("pipeline", { required: true });
  core.debug(`pipeline: '${pipelineName}'`);
  const waitCompletion = core.getBooleanInput("wait_completion") ?? true;
  core.debug(`wait_completion: '${waitCompletion}'`);

  // trigger pipeline
  const pipelineExecutionId = await pipelineTrigger(client, pipelineName);
  core.info(
    `[pipeline] triggered with pipelineExecutionId: ${pipelineExecutionId}`,
  );
  slack.messages[
    Date.now()
  ] = `pipeline: '${pipelineName}' triggered, executionId: ${pipelineExecutionId}`;

  if (waitCompletion) {
    slack.pipelineName = pipelineName;
    slack.pipelineExecutionId = pipelineExecutionId;
    const ts = await slackMessageCreate(slackToken, slackChannel, slack);

    // monitor progress and report to GitHub action
    const executionResult = await pipelineMonitor(
      client,
      pipelineName,
      pipelineExecutionId,
      /**
       * @param {any} data
       * @param {import("./aws.js").LoggerLevel} level
       */
      async (data, level) => {
        slack.messages[Date.now()] = data;

        switch (level) {
          case "info":
            slack.color = "#c6c6c6";
            core.info(data);
            break;
          case "error":
            slack.color = "#cc3300";
            core.error(data);
            break;
          case "warning":
            slack.color = "#ffcc00";
            core.warning(data);
            break;
          default:
            core.error(`Unknown log level, data: ${data}`);
        }

        await slackMessageUpdate(slackToken, slackChannel, ts, slack);
      },
    );

    if (!executionResult) {
      core.setFailed("Execution was unsuccessful.");
    } else {
      slack.color = "#339900";
      slack.messages[Date.now()] = "Successful";
      await slackMessageUpdate(slackToken, slackChannel, ts, slack);
    }
  }

  core.setOutput("data", {
    state: {
      slack,
    },
  });
} catch (error) {
  core.setFailed(error.message);
}
