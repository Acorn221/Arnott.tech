import baseConfig from "@arnott/eslint-config/react";

export default [
  ...baseConfig,
  {
    ignores: ["dist", "node_modules"],
  },
];
