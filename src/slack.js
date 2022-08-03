import fs from "fs";
import fetch from "node-fetch";

/**
 * Slack: ensure can make connection and has access
 *
 * Docs:
 *  - https://api.slack.com/methods/auth.test#errors
 *
 * @param {string} token
 * @param {string} channel
 * @returns {Promise<void>}
 */
export async function slackCredentialsValidate(token, channel) {
  const res = await fetch("https://slack.com/api/auth.test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel }),
  });

  const { ok, error } = await res.json();

  if (!ok) {
    throw new Error(error ?? "Slack credentials invalid");
  }
}

/**
 * Slack: send a slack message
 *
 * Docs:
 *  - https://api.slack.com/methods/chat.postMessage
 *
 * @param {string} token
 * @param {string} channel
 * @param {any} state
 * @returns {Promise<number>}
 */
export async function slackMessageCreate(token, channel, state) {
  const data = formatMessage(state);

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      ...data,
    }),
  });

  const { ok, error, ts } = await res.json();

  if (!ok) {
    throw new Error(error ?? "unknown error");
  }

  return ts;
}

/**
 * Slack: update Slack message with the provided `ts` (timestamp)
 *
 * Docs:
 *  - https://api.slack.com/methods/chat.update
 *
 * @param {string} token
 * @param {string} channel
 * @param {number} timestamp
 * @param {any} state
 * @returns {Promise<number>}
 */
export async function slackMessageUpdate(token, channel, timestamp, state) {
  const data = formatMessage(state);

  const res = await fetch("https://slack.com/api/chat.update", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      ts: timestamp,
      channel,
      ...data,
    }),
  });

  const { ok, error } = await res.json();

  if (!ok) {
    throw new Error(error ?? "unknown error");
  }
}

function formatMessage(state) {
  const awsRegion =
    process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "eu-central-1";

  // fetch GitHub event from path (same as `${{ github.event.* }})
  const event = JSON.parse(
    fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"),
  );

  return {
    blocks: [
      {
        type: "context",
        elements: [
          {
            type: "image",
            image_url: `${event.sender.avatar_url}`,
            alt_text: "",
          },
          {
            type: "plain_text",
            text: `Author: ${event.sender.login}`,
            emoji: true,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*New deploy* for <${event.repository.url}|${event.repository.name}> with <${event.compare}|${event.head_commit.id}>`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Commit Message:*\n",
        },
      },
      {
        type: "section",
        text: {
          type: "plain_text",
          text: `${event.head_commit.message}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              emoji: true,
              text: "Go to deployment",
            },
            style: "primary",
            url: `https://${awsRegion}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${state.pipelineName}/executions/${state.pipelineExecutionId}/visualization?region=${awsRegion}`,
            value: "codepipeline",
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Log entries*`,
        },
      },
    ],
    attachments: [
      {
        color: state.color,
        blocks: Object.entries(state.messages).map(([timestamp, data]) => ({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${new Date(parseInt(timestamp)).toLocaleTimeString(
              "nl-NL",
            )}: ${data}`,
          },
        })),
      },
    ],
  };
}
