import "dotenv/config";

import { stringify } from "csv/sync";

import { writeFileSync } from "fs";
import path from "path";

import cliArgs from "../src/cli-args.js";
import { getConversations } from "../src/slack.js";
import { fileNameBase, getFormattedDate, reactionsInclude } from "../src/utilities.js";
import { contentDataPoints, excludedUsers } from "../src/constants.js";

const {
  SLACK_CHANNEL_ID,
} = process.env;

(async () => {
  try {
    const { outputDir, debug } = cliArgs;

    const print = (text, type) => {
      if (!debug) {
        return;
      }
      switch (type) {
        case "skip":
          return console.log(`⏩ ${text}`);
        case "error":
          return console.log(`❌ ${text}`);
      }
      console.log(`🤖 ${text}`);
    };

    print(`Processing messages for channel ID ${SLACK_CHANNEL_ID}`);

    const slackData = await getConversations();

    if (!slackData.ok) {
      throw new Error(`Slack API returned ${slackData.error}`);
    }

    const { messages } = slackData;
    const totalMessages = messages.length;

    if (!totalMessages) {
      throw new Error(`No messages to process`);
    }

    const allMessages = [];
    for (const msg of messages) {
      const { type, user, user_profile, ts, subtype, text, reactions } = msg;

      if (reactionsInclude(reactions, "no_entry")) {
        print(`Skipping skipped message ${ts} ...`, "skip");
        continue;
      }

      if (subtype === "channel_join") {
        continue;
      }

      if (subtype === "channel_leave") {
        continue;
      }

      if (subtype === "thread_broadcast") {
        continue;
      }

      if (subtype === "channel_topic") {
        continue;
      }

      if (excludedUsers.includes(user)) {
        print(`Skipping uncounted user ${user} for message ${ts}...`, "skip");
        continue;
      }

      if (type !== "message" || !user_profile) {
        print(`Skipping invalid message ${ts}...`, "skip");
        continue;
      }

      allMessages.push({
        date: getFormattedDate(new Date(ts * 1000)),
        user,
        content: text,
      });
    }

    print(`Returned ${totalMessages} messages`);

    const csvData = Object.values(allMessages)
      .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

    const csvString = stringify(csvData, { columns: contentDataPoints, header: true });
    if (outputDir) {
      const csvFilePath = path.join(outputDir, `${fileNameBase("content")}.csv`);
      print(`Writing data to ${csvFilePath}`);
      writeFileSync(csvFilePath, csvString);
    } else {
      console.log(csvString);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
})();
