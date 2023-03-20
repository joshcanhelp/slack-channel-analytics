import { parseArgs } from "util";

const {
  FILE_OUTPUT_DIR,
  DEBUG,
} = process.env;

export default {
  ...{
    outputDir: FILE_OUTPUT_DIR,
    limit: 1000,
    debug: DEBUG,
  },
  ...parseArgs({
    strict: true,
    options: {
      inputJson: {
        type: "string",
      },
      outputDir: {
        type: "string",
      },
      limit: {
        type: "string",
      },
      debug: {
        type: "boolean",
      },
    },
  }).values
};