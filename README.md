# Smart Cita - Multi-Site Deployment

This repository hosts multiple sites under the smart-cita.com domain:

## Site Structure

- **Main Site**: `smart-cita.com`
  - Landing page for Smart Cita calendar integration provider
  - Files: `index.html`, `styles.css`

- **LaserOstop España**: `smart-cita.com/laserostop_espagna/`
  - Booking system for LaserOstop España centers
  - Full booking flow with Smart Agenda integration
  - Directory: `/laserostop_espagna/`

## Deployment

This site is deployed on Netlify and connected to the custom domain `smart-cita.com`.

### Adding More Sites

To add additional client sites under smart-cita.com:

1. Create a new subdirectory (e.g., `/client_name/`)
2. Add the site files to that directory
3. Update `netlify.toml` if needed for routing
4. The site will be accessible at `smart-cita.com/client_name/`

## Local Development

1. Open `index.html` for the main Smart Cita page
2. Open `laserostop_espagna/index.html` for the LaserOstop booking page
3. Use a local web server to test (e.g., `npx serve`)

## DNS Configuration

The domain `smart-cita.com` is registered on Namecheap and points to Netlify.

### DNS Settings:
- **A Record**: `@` → Netlify's load balancer IP
- **CNAME Record**: `www` → Netlify site URL

See Netlify's domain settings for the exact values.
