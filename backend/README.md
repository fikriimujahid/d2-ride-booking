# D2 Ride Booking Backend

## Description

NestJS backend skeleton for D2 Ride Booking application.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Security & Features

- **Helmet**: Secures HTTP headers.
- **CORS**: Enabled for cross-origin resource sharing.
- **Rate Limiting**: Configured using `@nestjs/throttler`.
- **Validation**: Global `ValidationPipe` with whitelist and transform enabled.
- **Swagger Documentation**: Available at `/api` and JSON at `/api-json`.
- **Health Check**: Endpoint at `/health`.

## Database Setup (Prisma + Postgres)

1. Ensure Docker is running.
2. Start the database:
   ```bash
   docker-compose up -d postgres
   ```
3. Copy `.env.example` to `.env` and set `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://user:rootpassword@localhost:5432/ridebooking?schema=public"
   ```
4. Run migrations:
   ```bash
   npx prisma migrate dev
   ```
5. Seed the database:
   ```bash
   npx prisma db seed
   ```

## API Documentation (Swagger & Postman)

### View Documentation
Once the application is running, open your browser and navigate to:
- **Swagger UI**: http://localhost:3000/api
- **Swagger JSON**: http://localhost:3000/api-json

### Export for Postman
You can generate the Swagger JSON file for import into Postman without running the server:

```bash
npm run swagger:export
```
This will generate a `swagger.json` file in the root of the `backend` directory.

### Import into Postman
1. Open Postman.
2. Click **Import**.
3. Drag and drop the `swagger.json` file (or paste the URL `http://localhost:3000/api-json`).
4. This will create a collection named "D2 Ride Booking API" with all requests configured.

### Authentication in Swagger
The API uses Bearer Token authentication (JWT).
1. Click the **Authorize** button in Swagger UI.
2. Enter your JWT Access Token (obtained from `/auth/login` or `/auth/respond-challenge`).
3. Click **Authorize**.
