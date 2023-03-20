import { analyticsDataPoints } from "./constants.js";

export const padLeftZero = (string) => {
  return `${string}`.length === 1 ? `0${string}` : `${string}`;
};

export const reactionsInclude = (reactions, reaction) =>
  reactions && reactions.some((r) => r.name === reaction);

export const sortByDateAsc = (a, b) => (a > b ? 1 : a < b ? -1 : 0);

export const fileNameBase = (name) => new Date().toISOString().split(".")[0].replaceAll(":", "-") + "GMT-channel-" + name;

export const getFormattedDate = (date) => {
  const yyyy = date.getFullYear();
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  return `${yyyy}-${padLeftZero(mm)}-${padLeftZero(dd)}`;
};

export const getNextDate = (formattedDate) => {
  const dateParts = formattedDate.split("-").map((number) => parseInt(number, 10));
  const nextDate = new Date();
  nextDate.setFullYear(dateParts[0]);
  nextDate.setMonth(dateParts[1] - 1);
  nextDate.setDate(dateParts[2] + 1);
  return getFormattedDate(nextDate);
};

export const makeEmptyDay = () => {
  const emptyDay = {};
  analyticsDataPoints.forEach((dp) => {
    emptyDay[dp.key] = dp.type === "string" ? "" : dp.type === "array" ? [] : 0;
  });
  return emptyDay;
};
