# service-passport-frontend

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_service-passport-frontend&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_service-passport-frontend)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_service-passport-frontend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_service-passport-frontend)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_service-passport-frontend&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_service-passport-frontend)

Core delivery platform Node.js Frontend Template.

## The prototype

Service Passport is a prototype for research. It plans the approvals a Defra service needs before it goes live and links to each decision. Every service, date and decision in it is example data.

Like a GOV.UK Prototype Kit prototype, it asks for a shared password when `PASSPORT_PASSWORD` is set. The real service would use your Defra account. Prototype controls on the passport and step pages stand in for time passing and for the teams that decide.

### Still to confirm before research

These rules and names are our best understanding. None has been checked with the team that owns it. The data lives in `src/server/data/journey.json`.

- Stage gate 4 meets at the latest 4 weeks before go-live, and papers go to the Portfolio Office 2 weeks before it.
- The senior responsible owner decides stage gate 4 at the project board.
- A beta assessment is needed only when people outside Defra use the service.
- Lead times: Technical Design Authority (2 weeks' notice, 2 weeks' review), IT health check (8 weeks' notice for a supplier, 2 for the CDP security team, a week of testing, 3 weeks of fixes), Platform Readiness Review (6 weeks' notice), accessibility audit (6 weeks' notice, 2 weeks of audit), data protection impact assessment (4 weeks' review, a week for sign-off), algorithmic transparency record (4 weeks, then 2 for sign-off), beta assessment (6 weeks' notice, report 2 weeks later, 2 weeks for a reassessment), change request (10 working days). Christmas adds 2 weeks.
- Who decides each step: Defra cyber security team (IT health check), CDP platform team (Platform Readiness Review), service owner (accessibility audit), information asset owner (data protection impact assessment), senior responsible owner (algorithmic transparency record), service transition manager (service tiering), change advisory board through MyIT (change request).
- Whether the architecture board is the Solution Design Authority or the Architectural Design Authority, and how both relate to the Technical Design Authority.
- Whether an IT health check must be an independent CHECK or CREST test, and whether it runs in perf-test or ext-test.
- The sections of the Service Design Pack and who signs them off.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Server-side Caching](#server-side-caching)
- [Redis](#redis)
- [Local Development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd service-passport-frontend
nvm use
```

## Server-side Caching

We use Catbox for server-side caching. By default the service will use CatboxRedis when deployed and CatboxMemory for
local development.
You can override the default behaviour by setting the `SESSION_CACHE_ENGINE` environment variable to either `redis` or
`memory`.

Please note: CatboxMemory (`memory`) is _not_ suitable for production use! The cache will not be shared between each
instance of the service and it will not persist between restarts.

## Redis

Redis is an in-memory key-value store. Every instance of a service has access to the same Redis key-value store similar
to how services might have a database (or MongoDB). All frontend services are given access to a namespaced prefixed that
matches the service name. e.g. `my-service` will have access to everything in Redis that is prefixed with `my-service`.

If your service does not require a session cache to be shared between instances or if you don't require Redis, you can
disable setting `SESSION_CACHE_ENGINE=false` or changing the default value in `src/config/index.js`.

## Proxy

We are using forward-proxy which is set up by default. Services are automatically configured with the proxy environment variables when deployed.

Node.js 24 uses these variables to route outbound HTTP(S) requests through the proxy:

NODE_USE_ENV_PROXY=1
HTTPS_PROXY=...
NO_PROXY=...

No additional proxy configuration is required in the service.

## Local Development

### Setup

Install application dependencies:

```bash
npm install
```

### Git hooks

Install git hooks (optional)

```bash
npm run git:hooks
```

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag service-passport-frontend`

Build:

```bash
docker build --target development --no-cache --tag service-passport-frontend:development .
```

Run:

```bash
docker run -p 3000:3000 service-passport-frontend:development
```

### Production image

Build:

```bash
docker build --no-cache --tag service-passport-frontend .
```

Run:

```bash
docker run -p 3000:3000 service-passport-frontend
```

### Docker Compose

A local environment with:

- Floci (replacing Localstack) for AWS services (S3, SQS)
- Redis
- MongoDB
- This service.
- A commented out backend example.

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties).

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
