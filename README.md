# AWS CodePipeline Trigger with Slack notification

## Prerequisites

- AWS CodePipeline
- AWS login role with the following policies
  - `codepipeline:StartPipelineExecution`
  - `codepipeline:GetPipeline`
  - `codepipeline:GetPipelineExecution`
  - `codepipeline:ListPipelineExecutions`
- A [Slack APP](https://api.slack.com/apps), with the scope: `chat:write`

# Usage

> To configure AWS credentials in GitHub Actions, use
> [configure-aws-credentials](https://github.com/marketplace/actions/configure-aws-credentials-action-for-github-actions).

See [action.yml](action.yml) for parameter (input) and output information. The
GitHub Action could look like this:

```yaml
- name: configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v1
  with:
    role-to-assume: arn:aws:iam::{accountId}:role/{roleName}

- name: Start CodePipeline
  id: pipeline
  uses: lightbasenl/aws-codepipeline-slack@{hash|tag}
  with:
    pipeline: my-pipeline
    wait_completion: true
    slack_token: xxxx-your-token-here
    slack_channel: Cxxxxxx

- name: Output
  run: echo '${{toJSON(steps.pipeline.outputs.data)}}'
```

## Contribute

Steps:

1. Make your changes in the `src` dir
2. Ensure deps needed during runtime are in the `dependencies` list inside the
   `package.json`
3. Follow below commands to create a new release
4. Use commit hash as GitHub action version (or create a version tag as pointer)

```shell
# commit
yarn --production
git add node_modules/* -f
git add action.yml src/* package.json yarn.lock README.md
git commit -m "Release {version}: {message}"
git push

# tag
git tag vX.X {commit} -f
git push --tags
```

## Sources

- https://docs.github.com/en/actions/creating-actions/about-custom-actions
- https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action

## Credits

Heavily based on https://github.com/moia-oss/aws-codepipeline-trigger
