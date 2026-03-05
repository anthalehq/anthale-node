# Changelog

## 0.4.0 (2026-03-05)

Full Changelog: [v0.3.0...v0.4.0](https://github.com/anthalehq/anthale-node/compare/v0.3.0...v0.4.0)

### Features

* implement openai integration ([d2ec5d3](https://github.com/anthalehq/anthale-node/commit/d2ec5d348172878ebf240f46b85a0066211f86c0))


### Chores

* **internal:** codegen related update ([54dd025](https://github.com/anthalehq/anthale-node/commit/54dd0257688c1a0a6bf9102cc58e4724445f2b54))

## 0.3.0 (2026-03-05)

Full Changelog: [v0.2.1...v0.3.0](https://github.com/anthalehq/anthale-node/compare/v0.2.1...v0.3.0)

### Features

* implement openai integration ([940380e](https://github.com/anthalehq/anthale-node/commit/940380efaa708fe71c992be0252b5033098e6a1e))


### Chores

* **internal:** codegen related update ([09190dc](https://github.com/anthalehq/anthale-node/commit/09190dcdcf96eb0099007d75e996685de5b6dbc5))

## 0.2.1 (2026-03-02)

Full Changelog: [v0.2.0...v0.2.1](https://github.com/anthalehq/anthale-node/compare/v0.2.0...v0.2.1)

### Chores

* update SDK settings ([3ec9d47](https://github.com/anthalehq/anthale-node/commit/3ec9d47e6b426becf64a1f31b1e8b81138f7d2fe))
* update SDK settings ([e8a556f](https://github.com/anthalehq/anthale-node/commit/e8a556f70656de0e98b5b4f728e5df22038ca9a4))

## 0.2.0 (2026-03-02)

Full Changelog: [v0.1.1...v0.2.0](https://github.com/anthalehq/anthale-node/compare/v0.1.1...v0.2.0)

### Features

* **api:** api update ([17a7951](https://github.com/anthalehq/anthale-node/commit/17a79514edb892256efdbf706f571fc99440bd89))
* **api:** manual updates ([44dd474](https://github.com/anthalehq/anthale-node/commit/44dd474f8ba126836b8436244fb0432920cb4845))
* **api:** manual updates ([9f63502](https://github.com/anthalehq/anthale-node/commit/9f635029fd59fc48f3d2836edcb56dbc05b97556))
* **api:** manual updates ([13f7306](https://github.com/anthalehq/anthale-node/commit/13f7306385657a182504d6dc17112fd5aebd1b54))


### Bug Fixes

* **client:** avoid memory leak with abort signals ([2d6dc67](https://github.com/anthalehq/anthale-node/commit/2d6dc677c1ba504eca7efc37bc82d54b2a23de33))
* **client:** avoid removing abort listener too early ([15285d6](https://github.com/anthalehq/anthale-node/commit/15285d65e85ae2fa8f6dd659c59b7ab28999e13d))
* **docs/contributing:** correct pnpm link command ([b4bf547](https://github.com/anthalehq/anthale-node/commit/b4bf5475f4fd1757df312ba2870d351584b2cf9b))


### Chores

* **ci:** upgrade `actions/github-script` ([6a710de](https://github.com/anthalehq/anthale-node/commit/6a710de114169dbe610286e24b554a5bd5e511cb))
* **client:** do not parse responses with empty content-length ([5b05ab7](https://github.com/anthalehq/anthale-node/commit/5b05ab7ff4891639d712cd22d3781d4211aa6499))
* **client:** restructure abort controller binding ([466b1c1](https://github.com/anthalehq/anthale-node/commit/466b1c130c5a2a4e88a9438d2930b12a6410e4f4))
* **internal/client:** fix form-urlencoded requests ([8b97ef3](https://github.com/anthalehq/anthale-node/commit/8b97ef34135b751016d27e3bd2ae40eef47c50b4))
* **internal:** avoid type checking errors with ts-reset ([eee4da2](https://github.com/anthalehq/anthale-node/commit/eee4da293cc4c3a19e0b1c7239323af8d87f7e0d))
* **internal:** move stringifyQuery implementation to internal function ([08f6128](https://github.com/anthalehq/anthale-node/commit/08f61285fa101090ddeff85a8d365e436ab6b753))
* **internal:** remove mock server code ([6d8b7e1](https://github.com/anthalehq/anthale-node/commit/6d8b7e1b6d3a1788e7d13e4bc83ca8851d8c1227))
* **internal:** upgrade pnpm ([e760ab8](https://github.com/anthalehq/anthale-node/commit/e760ab89a1032c534ee45ae2f565ef614401a36b))
* **internal:** upgrade pnpm version ([2535b5e](https://github.com/anthalehq/anthale-node/commit/2535b5e5b791f0085c53299ac772c7034ca3c081))
* update mock server docs ([5633dd8](https://github.com/anthalehq/anthale-node/commit/5633dd840a0bf34223aeb2303946fd2aeb587787))

## 0.1.1 (2026-01-19)

Full Changelog: [v0.1.0...v0.1.1](https://github.com/anthalehq/anthale-node/compare/v0.1.0...v0.1.1)

### Build System

* configure environment name for deploying ([2ae49d5](https://github.com/anthalehq/anthale-node/commit/2ae49d5d556ce0d589e09d74988d4934b02a5214))

## 0.1.0 (2026-01-19)

Full Changelog: [v0.0.1...v0.1.0](https://github.com/anthalehq/anthale-node/compare/v0.0.1...v0.1.0)

### Features

* **api:** disable mpc ([c1b2f5d](https://github.com/anthalehq/anthale-node/commit/c1b2f5dd757f7e3870447551d5d84d15e7bf08b8))


### Reverts

* refactor: rename package to @anthalehq/anthale ([cfe0447](https://github.com/anthalehq/anthale-node/commit/cfe0447102458d08e407c10cb9c03b0afdbb3216))
* refactor: rename package to @anthalehq/anthale ([7a7fc90](https://github.com/anthalehq/anthale-node/commit/7a7fc908b013a257ce498985c18c82b5048d1c2f))
* refactor: rename package to @anthalehq/anthale ([000da19](https://github.com/anthalehq/anthale-node/commit/000da197f3e7b604f8d5ca1dd08e58890d385ce1))


### Chores

* configure new SDK language ([3b63a8b](https://github.com/anthalehq/anthale-node/commit/3b63a8b3bc95d21960b503db860dfb072bedabb4))
* configure new SDK language ([69119b6](https://github.com/anthalehq/anthale-node/commit/69119b6ccc4409065fd79b0c0560a77e683de91a))
* remove custom code ([3658f0e](https://github.com/anthalehq/anthale-node/commit/3658f0eb33baeb2d80420df0a392cdd6da213093))
* update SDK settings ([6d320bc](https://github.com/anthalehq/anthale-node/commit/6d320bc14a0559d4788c5fe831f03b8390efa7cc))
* update SDK settings ([22ce456](https://github.com/anthalehq/anthale-node/commit/22ce456dca8d1535bc6b0fd506fa487a052583dd))
* update SDK settings ([06ce99d](https://github.com/anthalehq/anthale-node/commit/06ce99d0e102f0bdc55eef513e77f9a0461af931))


### Refactors

* rename package to @anthalehq/anthale ([22d5951](https://github.com/anthalehq/anthale-node/commit/22d595135275ecdab782e5db0dcfa38b0d238bdc))
* rename package to @anthalehq/anthale ([55e0e2d](https://github.com/anthalehq/anthale-node/commit/55e0e2d376e38ae18b58be4ab189024198397ea4))
* rename package to @anthalehq/anthale ([1ff0ad7](https://github.com/anthalehq/anthale-node/commit/1ff0ad74571cf79b16e191fed9305989678a9f0f))
* rename package to @anthalehq/anthale ([9f64ceb](https://github.com/anthalehq/anthale-node/commit/9f64ceb5627379598cd786587f8cab800e6bc908))


### Build System

* publish new version via oidc ([24a1568](https://github.com/anthalehq/anthale-node/commit/24a156895d25c04dab5ff3e8c38ce67831731473))

## 0.0.2 (2026-01-19)

Full Changelog: [v0.0.1...v0.0.2](https://github.com/anthalehq/anthale-node/compare/v0.0.1...v0.0.2)

### Chores

* configure new SDK language ([3b63a8b](https://github.com/anthalehq/anthale-node/commit/3b63a8b3bc95d21960b503db860dfb072bedabb4))
* configure new SDK language ([69119b6](https://github.com/anthalehq/anthale-node/commit/69119b6ccc4409065fd79b0c0560a77e683de91a))
* update SDK settings ([6d320bc](https://github.com/anthalehq/anthale-node/commit/6d320bc14a0559d4788c5fe831f03b8390efa7cc))
* update SDK settings ([22ce456](https://github.com/anthalehq/anthale-node/commit/22ce456dca8d1535bc6b0fd506fa487a052583dd))
* update SDK settings ([06ce99d](https://github.com/anthalehq/anthale-node/commit/06ce99d0e102f0bdc55eef513e77f9a0461af931))
