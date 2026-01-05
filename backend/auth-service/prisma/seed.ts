import { UserType } from '@prisma/client';
import { prisma } from '../src/utils/prisma';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
  CreateGroupCommand,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import { config } from '../src/config/env';

const cognitoClient = new CognitoIdentityProviderClient({ region: config.AWS_REGION });

async function createCognitoUser(email: string, password: string, groupName: string) {
  const username = email;
  let sub: string | undefined;

  try {
    // 1. Check if user exists
    const getUser = new AdminGetUserCommand({
      UserPoolId: config.COGNITO_USER_POOL_ID,
      Username: username,
    });
    const user = await cognitoClient.send(getUser);
    sub = user.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
    console.log(`User ${username} already exists in Cognito (sub: ${sub})`);
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      // 2. Create User
      console.log(`Creating user ${username} in Cognito...`);
      const createUser = new AdminCreateUserCommand({
        UserPoolId: config.COGNITO_USER_POOL_ID,
        Username: username,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
        ],
        MessageAction: MessageActionType.SUPPRESS, // Don't send email
      });
      const newUser = await cognitoClient.send(createUser);
      sub = newUser.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
    } else {
      throw error;
    }
  }

  // 3. Always Set/Reset Password (to ensure it matches seed)
  try {
    const setPassword = new AdminSetUserPasswordCommand({
      UserPoolId: config.COGNITO_USER_POOL_ID,
      Username: username,
      Password: password,
      Permanent: true,
    });
    await cognitoClient.send(setPassword);
    console.log(`Password set for ${username}`);
  } catch (error) {
    console.error(`Failed to set password for ${username}:`, error);
  }

  if (!sub) throw new Error('Failed to retrieve Cognito SUB');

  // 3.5 Ensure Group Exists
  try {
    const createGroup = new CreateGroupCommand({
      UserPoolId: config.COGNITO_USER_POOL_ID,
      GroupName: groupName,
      Description: 'Admin Group',
    });
    await cognitoClient.send(createGroup);
    console.log(`Group ${groupName} created`);
  } catch (error: any) {
    if (error.name !== 'GroupExistsException') {
      console.error(`Error creating group: ${error.message}`);
    }
  }

  // 4. Add to Group
  try {
    const addToGroup = new AdminAddUserToGroupCommand({
      UserPoolId: config.COGNITO_USER_POOL_ID,
      Username: username,
      GroupName: groupName,
    });
    await cognitoClient.send(addToGroup);
    console.log(`User ${username} added to group ${groupName}`);
  } catch (error) {
    console.error(`Error adding to group: ${error}`);
  }

  return sub;
}

async function main() {
  console.log('Seeding database...');

  // 1. Create Permissions
  const permissions = [
    { resource: 'drivers', action: 'read' },
    { resource: 'drivers', action: 'write' },
    { resource: 'financials', action: 'read' },
    { resource: 'financials', action: 'write' },
    { resource: 'system', action: 'manage' },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      update: {},
      create: p,
    });
  }

  // 2. Create Roles
  const roles = [
    { name: 'SUPER_ADMIN', description: 'Full access to everything' },
    { name: 'OPS_ADMIN', description: 'Manage drivers and rides' },
    { name: 'FINANCE_ADMIN', description: 'View financials only' },
    { name: 'READ_ONLY_ADMIN', description: 'View only access' },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    });
  }

  // 3. Assign Permissions to Roles
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  const allPermissions = await prisma.permission.findMany();

  if (superAdminRole) {
    for (const p of allPermissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: superAdminRole.id, permissionId: p.id },
      });
    }
  }

  const opsAdminRole = await prisma.role.findUnique({ where: { name: 'OPS_ADMIN' } });
  const driverPermissions = await prisma.permission.findMany({ where: { resource: 'drivers' } });

  if (opsAdminRole) {
    for (const p of driverPermissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: opsAdminRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: opsAdminRole.id, permissionId: p.id },
      });
    }
  }

  // 4. Create Super Admin User
  const superAdminEmail = config.SUPER_ADMIN_EMAIL;
  const superAdminPassword = config.SUPER_ADMIN_PASSWORD;

  console.log(`Ensuring Super Admin (${superAdminEmail}) exists...`);
  
  try {
    const cognitoSub = await createCognitoUser(superAdminEmail, superAdminPassword, 'admin');

    // Create/Update User in DB
    const user = await prisma.user.upsert({
      where: { email: superAdminEmail },
      update: { cognitoId: cognitoSub },
      create: {
        email: superAdminEmail,
        cognitoId: cognitoSub,
        userType: UserType.ADMIN,
      },
    });

    // Assign SUPER_ADMIN role
    if (superAdminRole) {
      await prisma.adminUserRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: superAdminRole.id } },
        update: {},
        create: { userId: user.id, roleId: superAdminRole.id },
      });
      console.log(`Assigned SUPER_ADMIN role to ${superAdminEmail}`);
    }

  } catch (error) {
    console.error('Error creating Super Admin:', error);
  }

  // 5. Create Driver User
  const driverEmail = config.DRIVER_EMAIL;
  const driverPassword = config.DRIVER_PASSWORD;

  console.log(`Ensuring Driver (${driverEmail}) exists...`);
  try {
    const cognitoSub = await createCognitoUser(driverEmail, driverPassword, 'driver');

    await prisma.user.upsert({
      where: { email: driverEmail },
      update: { cognitoId: cognitoSub },
      create: {
        email: driverEmail,
        cognitoId: cognitoSub,
        userType: UserType.DRIVER,
      },
    });
    console.log(`Created Driver user in DB`);
  } catch (error) {
    console.error('Error creating Driver:', error);
  }

  // 6. Create Passenger User
  const passengerEmail = config.PASSENGER_EMAIL;
  const passengerPassword = config.PASSENGER_PASSWORD;

  console.log(`Ensuring Passenger (${passengerEmail}) exists...`);
  try {
    const cognitoSub = await createCognitoUser(passengerEmail, passengerPassword, 'passenger');

    await prisma.user.upsert({
      where: { email: passengerEmail },
      update: { cognitoId: cognitoSub },
      create: {
        email: passengerEmail,
        cognitoId: cognitoSub,
        userType: UserType.PASSENGER,
      },
    });
    console.log(`Created Passenger user in DB`);
  } catch (error) {
    console.error('Error creating Passenger:', error);
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
