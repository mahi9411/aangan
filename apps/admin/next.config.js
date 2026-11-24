const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@aangan/contracts'],
  outputFileTracingRoot: path.join(__dirname, '../..'),
}

module.exports = nextConfig
