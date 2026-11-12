const auth = require('./auth');
const staticRoutes = require('./static');
const admin = require('./admin');
const alliance = require('./alliance');

module.exports = {
  auth,
  static: staticRoutes,
  admin,
  alliance,
};
