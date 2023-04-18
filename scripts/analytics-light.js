import "dotenv/config";

import cliArgs from "../src/cli-args.js";
import { getConversations } from "../src/slack.js";
import { getFormattedDate, sortByDateAsc } from "../src/utilities.js";
import { excludedUsers } from "../src/constants.js";

(async () => {
  try {
    const { limit, latest } = cliArgs;

    const slackData = await getConversations(parseInt(limit, 10), latest);

    if (!slackData.ok) {
      throw new Error(`Slack API returned ${slackData.error}`);
    }

    const { messages } = slackData;
    const totalMessages = messages.length;

    if (!totalMessages) {
      throw new Error(`No messages to process`);
    }

    const dailyStats = {};
    for (const msg of messages) {
      const { type, user, user_profile, ts, reply_users, subtype } = msg;

      const tsFloat = parseFloat(ts);
      const tsDate = getFormattedDate(new Date(tsFloat * 1000));

      if (!dailyStats[tsDate]) {
        dailyStats[tsDate] = {
          date: tsDate,
          total: 0,
          answered: 0,
          activeUsers: 0,
          usersPosted: [],
          usersReplied: [],
        };
      }

      if (
        ["channel_join", "channel_leave", "thread_broadcast", "channel_topic"].includes(subtype)
      ) {
        continue;
      }

      if (excludedUsers.includes(user)) {
        continue;
      }

      if (type !== "message" || !user_profile) {
        continue;
      }

      dailyStats[tsDate].usersPosted.push(user);

      dailyStats[tsDate].total++;
      if (reply_users && reply_users.length) {
        const filteredReplyUsers = reply_users.filter((userReplied) => {
          if (!excludedUsers.includes(userReplied) && userReplied !== user) {
            dailyStats[tsDate].usersReplied.push(userReplied);
            return true;
          }
        });

        if (filteredReplyUsers.length) {
          dailyStats[tsDate].answered++;
        }
      }

      const allUsers = [...dailyStats[tsDate].usersPosted, ...dailyStats[tsDate].usersReplied];
      dailyStats[tsDate].activeUsers = [...new Set(allUsers)].length;
    }

    const collectedDays = Object.keys(dailyStats).sort(sortByDateAsc);

    // Trim first day to ensure a complete starting day
    delete dailyStats[collectedDays[0]];

    console.log("Date,Total,Answered,Percent answered,Active users");
    Object.values(dailyStats)
      .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))
      .forEach((day) => {
        const answeredPercent = day.total ? Math.ceil((day.answered / day.total) * 100) : 100;
        console.log(
          day.date +
            "," +
            day.total +
            "," +
            day.answered +
            "," +
            answeredPercent +
            "%," +
            day.activeUsers
        );
      });
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
})();
