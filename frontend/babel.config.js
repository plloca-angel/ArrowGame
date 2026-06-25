module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // App does not use Reanimated/worklets — disabling avoids Expo Go runtime crashes.
          worklets: false,
          reanimated: false,
        },
      ],
    ],
  };
};
