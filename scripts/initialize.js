#!/usr/bin/env node

/**
 * Initialize database script
 * Usage:
 *   node scripts/initialize.js         # Initialize (preserves existing data)
 *   node scripts/initialize.js --force # Force reset (deletes database and starts fresh)
 *   npm run initialize -- --force      # Via npm (requires extra --)
 */

import { execSync } from 'child_process';
import http from 'http';
import { existsSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const forceFlag = args.includes('--force');

async function initializeDatabase(force = false) {
	console.log('========================================');
	console.log('  Database Initialization Script');
	console.log('========================================\n');

	if (force) {
		console.log('⚠️  FORCE MODE: Will delete existing database!\n');

		// First, delete the D1 database file to avoid SQLITE_MISMATCH errors
		const dbDir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
		if (existsSync(dbDir)) {
			console.log('🗑️  Deleting D1 database files...');
			try {
				const files = readdirSync(dbDir);
				for (const file of files) {
					if (file.endsWith('.sqlite') || file.endsWith('.sqlite-shm') || file.endsWith('.sqlite-wal')) {
						rmSync(join(dbDir, file), { force: true });
						console.log(`   Deleted: ${file}`);
					}
				}
				console.log('✅ Database files deleted\n');
			} catch (error) {
				console.warn('⚠️  Warning: Could not delete database files:', error.message);
			}
		}

		// Then call the force reinitialize endpoint
		try {
			console.log('🗑️  Dropping database tables...');
			await callAPI('DELETE', '/api/initialize');
			console.log('✅ Tables dropped successfully\n');
		} catch (error) {
			if (error.message.includes('ECONNREFUSED')) {
				console.error('❌ Error: Server is not running. Please start the dev server first:');
				console.error('   npm run dev\n');
				process.exit(1);
			}
			console.error('❌ Error dropping tables:', error.message);
			process.exit(1);
		}
	}

	// Build the project
	console.log('🔨 Building project...');
	try {
		execSync('npm run build', { stdio: 'inherit' });
		console.log('✅ Build completed\n');

		// Wait a bit for the worker to stabilize after build
		console.log('⏳ Waiting for worker to stabilize...');
		await new Promise(resolve => setTimeout(resolve, 2000));
		console.log('✅ Ready\n');
	} catch (error) {
		console.error('❌ Build failed');
		process.exit(1);
	}

	// Initialize the database
	console.log('🚀 Initializing database...');
	try {
		const result = await callAPI('POST', '/api/initialize');
		console.log('✅ Database initialized successfully!\n');

		if (force) {
			console.log('========================================');
			console.log('  Default Admin Credentials');
			console.log('========================================\n');
			console.log('📧 Master Tenant (localhost:8787)');
			console.log('   Email:    admin@localhost.dev');
			console.log('   Password: admin123\n');
			console.log('📧 Tenant-2 (tenant-2.localhost:8787)');
			console.log('   Email:    admin@tenant-2.dev');
			console.log('   Password: admin123\n');
			console.log('⚠️  IMPORTANT: Change these passwords in production!\n');
		}
	} catch (error) {
		if (error.message.includes('ECONNREFUSED')) {
			console.error('❌ Error: Server is not running. Please start the dev server first:');
			console.error('   npm run dev\n');
			process.exit(1);
		}
		console.error('❌ Initialization failed:', error.message);
		process.exit(1);
	}
}

function callAPI(method, path) {
	return new Promise((resolve, reject) => {
		const options = {
			hostname: 'localhost',
			port: 8787,
			path: path,
			method: method,
			headers: {
				'Content-Type': 'application/json',
			},
		};

		const req = http.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				if (res.statusCode >= 200 && res.statusCode < 300) {
					try {
						resolve(JSON.parse(data));
					} catch {
						resolve({ message: data });
					}
				} else {
					reject(new Error(`API returned status ${res.statusCode}: ${data}`));
				}
			});
		});

		req.on('error', (error) => {
			reject(error);
		});

		req.end();
	});
}

// Run the script
initializeDatabase(forceFlag).catch((error) => {
	console.error('❌ Fatal error:', error);
	process.exit(1);
});
