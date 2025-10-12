export const withAuth = (handler) => (req, res) => {
  req.user = { sub: 'test-user-id' };
  return handler(req, res);
};