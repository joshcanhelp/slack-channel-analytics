import slack from "@slack/bolt";

const {
  SLACK_CHANNEL_ID,
  SLACK_BOT_TOKEN,
  SLACK_SIGNING_SECRET,
} = process.env;

if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL_ID || !SLACK_SIGNING_SECRET) {
  console.log("❌ Missing required config");
  process.exit(1);
}

const app = new slack.App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
}).client.conversations;

export const getConversations = async (limit = 0) => await app.history({
  channel: SLACK_CHANNEL_ID,
  limit,
});