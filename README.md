# Slack Channel Analytics

This script, given Slackbot credentials and a Slack channel ID, will generate a CSV containing aggregate daily post data. This data can be used to approximate performance and engagement for a channel that is used as a Q&A community (top-level messages as questions, thread replies as responses).

## Getting Started

Do the dance:

```bash
$ git clone git@github.com:joshcanhelp/slack-channel-analytics.git
$ npm install
```

[Create a new Slack app](https://api.slack.com/apps?new_app=1&ref=bolt_start_hub) with the [required permissions for the conversations.history API endpoint](https://api.slack.com/methods/conversations.history#facts). You will need the **Bot User OAuth Token** under "OAuth and Permissions" and the **Signing Secret** under "Basic Information > App Credentials."

In Slack, find the channel to want to pull analytics for, visit the channel's **About** tab, and copy the **Channel ID** that appears at the bottom.

Clone this repo and reate an `.env` file in the root directory of this project. Include the following:

```bash
# Required
SLACK_BOT_TOKEN=""
SLACK_SIGNING_SECRET=""
SLACK_CHANNEL_ID=""

# Optional
DAYS_TO_STABLE_STATE=""
FILE_OUTPUT_DIR="/path/to/output/dir"
DEBUG="1"
OLDEST_MESSAGE_TIMESTAMP="1672560000"
```

- `SLACK_*` values come from the Slack setup steps above
- `DAYS_TO_STABLE_STATE` is a positive integer indicating how many days in the past the analytics should start from today
- `FILE_OUTPUT_DIR` is the absolute path to an existing local directory where the JSON and CSV files should be stored. This can also be indicated in the script arguments for one-off runs.
- `DEBUG` will output status to the console during the run
- `OLDEST_MESSAGE_TIMESTAMP` set to a valid UNIX timestamp in seconds for your Slack timezone will only pull messages after that date

## Message Reactions

This script will look for specific emoji reactions on Slack messages to determine what column they are added to:

✅ to indicate a message that was successfully answered

⏹ to indicate a message that was abandoned without a resolution

↪️ to indicate a message that was redirected elsewhere

❓ to indicate a message with no response

⛔️ to indicate a message that should not be considered in analytics

## Running the Scripts

### Analytics

This is meant to be run on messages that have been tagged with an emoji.

Running the script is as simple as:

```bash
$ node scripts/analytics.js
```

To see more output during processing, use:

```bash
$ DEBUG=1 node scripts/analytics.js
# or ...
$ node scripts/analytics.js --debug
```

To run the analytics on an existing Slack API JSON file to test changes to the processing without an HTTP request:

```bash
$ node scripts/analytics.js --inputJson="/path/to/slack.json"
```

To change the output directory for a single run:

```bash
$ FILE_OUTPUT_DIR="/path/to/new/output/" node scripts/analytics.js
# or ...
$ node scripts/analytics.js --outputDir="/path/to/new/output/"
```

To output the CSV to the console:

```bash
$ FILE_OUTPUT_DIR="" node scripts/analytics.js
# or ...
$ node scripts/analytics.js --outputDir=""
```

To limit the number of messages returned (default is 1000):

```bash
$ node scripts/analytics.js --limit=100
```

### Analytics Light

This is a quick, low-feature run to get a best guess at the number of posts and replies without emoji tagging.

Run the script for latest batch of conversations:

```bash
$ node scripts/analytics-light.js
```

The output is CSV-formatted so you can save to a file as well:

```bash
$ node scripts/analytics-light.js > ~/Downloads/analytics-light.csv
```

Include a Unix timestamp in a `latest` argument to look at a specific date range:

```bash
$ node scripts/analytics-light.js --latest=1667286000
```

To limit the number of messages returned (default is 1000):

```bash
$ node scripts/analytics-light.js --limit=100
```
