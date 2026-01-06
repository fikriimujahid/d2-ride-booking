// scripts/cognito-seed.ts
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  CreateGroupCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env relative to this script
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const region = process.env.AWS_REGION;
const userPoolId = process.env.COGNITO_USER_POOL_ID;

if (!region || !userPoolId) {
  console.error('Missing AWS_REGION or COGNITO_USER_POOL_ID in .env');
  process.exit(1);
}

const client = new CognitoIdentityProviderClient({ region });

const users = [
  { email: 'superadmin@example.com', group: 'Admin' },
  { email: 'driver1@example.com', group: 'Driver' },
  { email: 'passenger1@example.com', group: 'Passenger' },
];

const groups = ['Admin', 'Driver', 'Passenger'];

async function main() {
  console.log(`Using User Pool: ${userPoolId} in ${region}`);

  // 1. Create Groups
  console.log('--- Ensuring Groups Exist ---');
  for (const group of groups) {
    try {
      await client.send(
        new CreateGroupCommand({
          UserPoolId: userPoolId,
          GroupName: group,
          Description: `${group} Group`,
        }),
      );
      console.log(`✅ Group created: ${group}`);
    } catch (e: any) {
      if (e.name === 'GroupExistsException') {
        console.log(`ℹ️  Group already exists: ${group}`);
      } else {
        console.error(`❌ Error creating group ${group}:`, e.message);
      }
    }
  }

  // 2. Create Users
  console.log('\n--- Creating Users ---');
  for (const user of users) {
    const password = 'TempPassword123!';
    try {
      // Create User
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: user.email,
          UserAttributes: [
             { Name: 'email', Value: user.email },
             { Name: 'email_verified', Value: 'true' }
          ],
          TemporaryPassword: password,
          MessageAction: 'SUPPRESS', // Don't send email
        }),
      );
      console.log(`✅ User created: ${user.email}`);

      // Set Permanent Password (optional: if you want to skip FORCE_CHANGE_PASSWORD)
      // Requirement says: "Temporary password", "Force password change".
      // AdminCreateUser with TemporaryPassword sets status to FORCE_CHANGE_PASSWORD by default.
      
      // Assign to Group
      await client.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: user.email,
          GroupName: user.group,
        }),
      );
      console.log(`   Detailed to group: ${user.group}`);

    } catch (e: any) {
      if (e.name === 'UsernameExistsException') {
        console.log(`ℹ️  User already exists: ${user.email}`);
        // Ensure group membership even if exists
        try {
            await client.send(
                new AdminAddUserToGroupCommand({
                  UserPoolId: userPoolId,
                  Username: user.email,
                  GroupName: user.group,
                }),
              );
             console.log(`   Detailed to group: ${user.group}`);
        } catch(grpErr: any) {
             console.log(`   (Already in group or error: ${grpErr.message})`);
        }
      } else {
        console.error(`❌ Error creating user ${user.email}:`, e.message);
      }
    }
    
    // Print credentials
    console.log(`   Credentials -> User: ${user.email} | Pass: ${password}`);
  }
}

main();
