import { CognitoJwtVerifier } from "aws-jwt-verify";
import jwt from 'jsonwebtoken';

// Mock values for dev if env vars are missing
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || "us-east-1_xxxxxxxxx";
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "xxxxxxxxxxxx";
const TOKEN_USE = process.env.COGNITO_TOKEN_USE || "access";

// Verifier for Cognito tokens
const verifier = CognitoJwtVerifier.create({
    userPoolId: USER_POOL_ID,
    tokenUse: TOKEN_USE as "access" | "id",
    clientId: CLIENT_ID,
});

export const verifyJWT = async (token: string) => {
    try {
        // For development/mocking purposes when Cognito isn't set up
        if (process.env.NODE_ENV === 'development' && process.env.MOCK_AUTH === 'true') {
            const decoded = jwt.decode(token);
            return decoded as { sub: string; email: string; 'custom:role': string };
        }

        const payload = await verifier.verify(token);
        return payload;
    } catch {
        throw new Error("Invalid token");
    }
};

export const generateJWT = (payload: object) => {
    // Helper for tests
    return jwt.sign(payload, 'secret', { expiresIn: '1h' });
}
