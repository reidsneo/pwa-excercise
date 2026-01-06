#!/bin/bash

# Initialize D1 database for local development

echo "🗄️  Initializing D1 database..."

# Execute migration
npx wrangler d1 execute sample-worker-neo-db --local --file=./migrations/0001_init.sql

echo ""
echo "✅ Database initialized successfully!"
echo ""
echo "📊 Database contents:"
echo ""

# Show roles
echo "Roles:"
npx wrangler d1 execute sample-worker-neo-db --local --command="SELECT * FROM roles"

echo ""
echo "Permissions (first 5):"
npx wrangler d1 execute sample-worker-neo-db --local --command="SELECT id, name, resource, action FROM permissions LIMIT 5"

echo ""
echo "✨ Setup complete! You can now start the development server."
