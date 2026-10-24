// Express 4 does not forward rejected handler promises to its error middleware.
module.exports = function asyncHandlers(handlers) {
  return Object.fromEntries(Object.entries(handlers).map(([name,handler]) => [name,(req,res,next) => {
    Promise.resolve().then(() => handler(req,res,next)).catch(next);
  }]));
};
