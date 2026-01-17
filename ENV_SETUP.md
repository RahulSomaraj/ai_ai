# Environment Configuration Guide

This project supports multiple environments: **Development**, **UAT**, and **Production**.

## 📁 Environment Files

- `.env.example` - Template with all available variables
- `.env.development` - Development environment (default)
- `.env.uat` - User Acceptance Testing environment
- `.env.production` - Production environment

## 🚀 Quick Start

### Development

```bash
# Copy example file
cp .env.example .env

# Or use development template
cp .env.development .env

# Start server
npm run start:dev
```

### UAT

```bash
# Copy UAT configuration
cp .env.uat .env

# Set NODE_ENV
export NODE_ENV=production

# Start server
npm run start:prod
```

### Production

```bash
# Copy production configuration
cp .env.production .env

# Set NODE_ENV
export NODE_ENV=production

# Set secure database password
export DB_PASSWORD=your-secure-password

# Start server
npm run start:prod
```

## 🔧 Environment Loading

The system loads environment files in this order:

1. `.env.${NODE_ENV}` (e.g., `.env.production`)
2. `.env` (fallback)

**Example:**
- If `NODE_ENV=production`, it loads `.env.production` first, then `.env`
- If `NODE_ENV` is not set, it defaults to `development` and loads `.env.development`

## 📋 Configuration Differences

### Development
- ✅ Swagger enabled
- ✅ Database logging enabled
- ✅ CORS: `*` (all origins)
- ✅ Rate limiting disabled
- ✅ Local database connection

### UAT
- ✅ Swagger enabled (for testing)
- ❌ Database logging disabled
- 🔒 CORS: Restricted origins
- ⚖️ Rate limiting: Moderate (200 req/15min)
- 🌐 UAT database server

### Production
- ❌ Swagger disabled
- ❌ Database logging disabled
- 🔒 CORS: Strict (specific domains)
- 🔒 Rate limiting: Strict (100 req/15min)
- 🔐 Production database with SSL
- 🔐 Secure password via environment variable

## 🔐 Security Best Practices

### Production Checklist

- [ ] Use strong database passwords
- [ ] Store passwords in environment variables (not in `.env` file)
- [ ] Enable SSL for database connections (`sslmode=require`)
- [ ] Restrict CORS to specific domains
- [ ] Disable Swagger in production
- [ ] Use connection pooling (higher pool size)
- [ ] Set appropriate rate limits
- [ ] Disable database query logging

### Environment Variables (Never Commit)

```bash
# Store these in your CI/CD or deployment platform
DB_PASSWORD=your-secure-password
DATABASE_URL=postgresql://user:${DB_PASSWORD}@host:5432/db
```

## 🧪 Testing Different Environments

### Local Development

```bash
# Use development config
NODE_ENV=development npm run start:dev
```

### Test UAT Config Locally

```bash
# Copy UAT config
cp .env.uat .env

# Start with UAT settings
NODE_ENV=production npm run start:dev
```

### Test Production Config Locally

```bash
# Copy production config
cp .env.production .env

# Set required variables
export DB_PASSWORD=test-password

# Start server
NODE_ENV=production npm run start:dev
```

## 📊 Configuration Comparison

| Setting | Development | UAT | Production |
|---------|------------|-----|------------|
| **Swagger** | ✅ Enabled | ✅ Enabled | ❌ Disabled |
| **DB Logging** | ✅ Enabled | ❌ Disabled | ❌ Disabled |
| **CORS** | `*` | Restricted | Strict |
| **Rate Limit** | Disabled | 200/15min | 100/15min |
| **DB Pool** | 2-5 | 5-20 | 10-50 |
| **SSL** | ❌ | ⚠️ Optional | ✅ Required |

## 🔄 Switching Environments

### Method 1: Copy File

```bash
# Development
cp .env.development .env

# UAT
cp .env.uat .env

# Production
cp .env.production .env
```

### Method 2: Use NODE_ENV

The system automatically loads `.env.${NODE_ENV}`:

```bash
# Development (default)
npm run start:dev

# UAT
NODE_ENV=production cp .env.uat .env && npm run start:prod

# Production
NODE_ENV=production cp .env.production .env && npm run start:prod
```

## 🛡️ Security Notes

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Use `.env.example`** - Safe template for documentation
3. **Store secrets in CI/CD** - Use platform secrets management
4. **Rotate passwords** - Regularly update database passwords
5. **Use SSL** - Always use SSL in production (`sslmode=require`)

## 📝 Example: CI/CD Integration

### GitHub Actions

```yaml
env:
  NODE_ENV: production
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
```

### Docker

```dockerfile
ENV NODE_ENV=production
COPY .env.production .env
```

### Kubernetes

```yaml
env:
  - name: NODE_ENV
    value: "production"
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: db-secret
        key: url
```

## ✅ Verification

Check which environment is active:

```bash
# Check loaded config
curl http://localhost:3000/v1/health

# Check logs
# Should show: "🌍 Environment: development|production"
```

---

**Remember:** Always use environment-specific files and never commit actual `.env` files with real credentials!
