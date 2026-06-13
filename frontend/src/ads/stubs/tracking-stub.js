/** Metro stub — tracking transparency is native-build only. */
module.exports = {
  requestTrackingPermissionsAsync: async () => ({ status: "undetermined" }),
  getTrackingPermissionsAsync: async () => ({ status: "undetermined" }),
};
