import { getUserFromToken } from "../lib/auth-utils.js";

/**
 * Express middleware that validates the Bearer token and attaches the
 * resolved user to req.user: { IdUser, IdOrganization, Role, Email }
 *
 * Returns 401 if the token is missing or invalid.
 */
export async function requireAuth(req, res, next) {
	const token = req.headers.authorization?.replace("Bearer ", "");
	const user = await getUserFromToken(token);
	if (!user) return res.status(401).json({ error: "Unauthorized" });
	req.user = user;
	next();
}
