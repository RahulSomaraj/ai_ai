# Configuration System

Centralized configuration management for the application.

## Structure

```
src/config/
├── config.module.ts      # Main config module
├── database.config.ts    # Database configuration
├── app.config.ts         # Application configuration
├── swagger.config.ts     # Swagger/API docs configuration
└── index.ts              # Exports
```

## Usage

### Accessing Configuration

```typescript
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MyService {
  constructor(private readonly configService: ConfigService) {}

  someMethod() {
    // Access app config
    const appConfig = this.configService.get('app');
    const port = appConfig.port;
    
    // Access database config
    const dbConfig = this.configService.get('database');
    const dbUrl = dbConfig.url;
    
    // Access swagger config
    const swaggerConfig = this.configService.get('swagger');
    const swaggerPath = swaggerConfig.path;
  }
}
```

### Environment Variables

#### Application (`app.config.ts`)

```env
APP_NAME=AI AI API
APP_VERSION=1.0.0
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
GLOBAL_PREFIX=v1
CORS_ENABLED=true
CORS_ORIGIN=*
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

#### Database (`database.config.ts`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/ai_ai_db?schema=public
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_LOGGING=false
```

#### Swagger (`swagger.config.ts`)

```env
SWAGGER_ENABLED=true
SWAGGER_PATH=docs
SWAGGER_TITLE=AI AI API - Academic Management System
SWAGGER_DESCRIPTION=Foundation system for managing subjects, textbooks, and syllabus...
SWAGGER_VERSION=1.0
SWAGGER_CONTACT_NAME=API Support
SWAGGER_CONTACT_EMAIL=support@example.com
SWAGGER_CONTACT_URL=https://example.com
SWAGGER_BEARER_AUTH=true
```

## Configuration Objects

### App Config

```typescript
{
  name: string;
  version: string;
  port: number;
  host: string;
  env: 'development' | 'production' | 'test';
  globalPrefix: string;
  cors: {
    enabled: boolean;
    origin: string;
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    max: number;
  };
}
```

### Database Config

```typescript
{
  url: string;
  pool: {
    min: number;
    max: number;
  };
  logging: boolean;
}
```

### Swagger Config

```typescript
{
  enabled: boolean;
  path: string;
  title: string;
  description: string;
  version: string;
  contact: {
    name?: string;
    email?: string;
    url?: string;
  };
  bearerAuth: {
    enabled: boolean;
  };
}
```

## Benefits

1. **Centralized**: All configs in one place
2. **Type-safe**: TypeScript types for all configs
3. **Environment-aware**: Easy to override per environment
4. **Validated**: Default values prevent runtime errors
5. **Cached**: Configs are cached for performance

## Adding New Configuration

1. Create a new config file: `src/config/my-feature.config.ts`
2. Use `registerAs` to register the config namespace
3. Add it to `config.module.ts` in the `load` array
4. Export from `index.ts`

Example:

```typescript
// src/config/my-feature.config.ts
import { registerAs } from '@nestjs/config';

export const myFeatureConfig = registerAs('myFeature', () => ({
  enabled: process.env.MY_FEATURE_ENABLED === 'true',
  apiKey: process.env.MY_FEATURE_API_KEY || '',
}));
```

Then add to `config.module.ts`:

```typescript
load: [databaseConfig, appConfig, swaggerConfig, myFeatureConfig],
```
