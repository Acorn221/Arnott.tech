import baseConfig from "@arnott/eslint-config/base";

export default [
  ...baseConfig,
  {
    ignores: ["dist", "node_modules"],
  },
];
