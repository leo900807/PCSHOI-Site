# PCSHOI Site

[![Build CI](https://github.com/leo900807/PCSHOI-Site/actions/workflows/Build-CI.yml/badge.svg)](https://github.com/leo900807/PCSHOI-Site/actions/workflows/Build-CI.yml)

A site about information contest in PCSH.  

Node.js version: v22.14.0

## Installation

#### 1. Install prerequisites

```bash
$ sudo apt-get update
$ sudo apt-get install gcc g++ make
$ curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
$ sudo apt-get install mysql-server nodejs redis
$ sudo npm install -g npm@latest
```

Configure MySQL before doing step 2.

#### 2. Clone PCSHOI-Site repo

```bash
$ git clone https://github.com/leo900807/PCSHOI-Site.git
$ cd PCSHOI-Site
```

#### 3. Install node modules

```bash
$ npm install
```

#### 4. Edit environment variables

Copy `.env.sample` to `.env` and edit variable values.  

Copy `src/data-source.ts.sample` to `src/data-source.ts` and edit to appropriate values.

#### 5. Setup database

```bash
$ npm run db:create
$ npm run db:seed
```

#### 6. Start Redis

```bash
$ sudo service redis start
```

#### 7. Run

```bash
$ npm start
```

#### 8. Admin page is at URI "/admin"
