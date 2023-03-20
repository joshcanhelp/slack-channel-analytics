export const excludedUsers = [
  "USLACKBOT", // Slackbot
  "U040ZRHT2KH", // y0da
];

export const dataPoints = [
  {
    key: "date",
    header: "Date",
    type: "string",
  },
  {
    key: "total",
    header: "Total posts",
  },
  {
    key: "responses",
    header: "Total responses",
  },
  {
    key: "answered",
    header: "Posts answered",
  },
  {
    key: "abandoned",
    header: "Posts abandoned",
  },
  {
    key: "redirected",
    header: "Posts redirected",
  },
  {
    key: "unanswered",
    header: "Posts unanswered",
  },
  {
    key: "unmoderated",
    header: "Posts unmoderated",
  },
  {
    key: "joins",
    header: "Channel joins",
  },
  {
    key: "leaves",
    header: "Channel leaves",
  },
  {
    key: "reposts",
    header: "Reposts",
  },
  {
    key: "activeUsers",
    header: "Active users",
  },
  {
    key: "usersPosted",
    header: "Users who posted",
    type: "array",
  },
  {
    key: "usersResponded",
    header: "Users who responded",
    type: "array",
  },
];

export const reactionMap = {
  answered: "white_check_mark",
  abandoned: "black_square_for_stop",
  redirected: "redirect",
  unanswered: "question",
};