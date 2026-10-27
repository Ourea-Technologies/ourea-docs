// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The language/transport switcher's tabs, in display order. `slug` is the
// ?lang= value; `label` is the tab text Starlight's synced tabs key on;
// `refKey` is the SDK's key in examples/sdk-refs.json and examples/sdk/index.json.
// Package names, install commands and registries come from
// ensemble-weather-spec SDK-STANDARD.md ("Names", "Releases").

export const TRANSPORTS = [
  { slug: 'curl', label: 'curl', hl: 'bash' },
  { slug: 'capnp', label: "Cap'n Proto", hl: 'bash' },
];

export const SDKS = [
  {
    slug: 'python',
    label: 'Python',
    hl: 'python',
    repoName: 'ensemble-weather-python',
    refKey: 'python',
    package: 'ensemble-weather (import ensemble_weather)',
    install: 'pip install ensemble-weather',
    registry: { name: 'PyPI', url: 'https://pypi.org/project/ensemble-weather/' },
    reference: { name: 'Read the Docs', url: 'https://ensemble-weather.readthedocs.io' },
    transport: 'httpx, the one runtime dependency (sync and async clients from one API)',
    page: '/weather-api/python/',
  },
  {
    slug: 'typescript',
    label: 'TypeScript',
    hl: 'ts',
    repoName: 'ensemble-weather-typescript',
    refKey: 'typescript',
    package: 'ensemble-weather on npm',
    install: 'npm install ensemble-weather',
    registry: { name: 'npm', url: 'https://www.npmjs.com/package/ensemble-weather' },
    // TypeDoc, built from the SDK's typedoc.json and published with GitHub Pages.
    reference: { name: 'TypeDoc', url: 'https://ourea-technologies.github.io/ensemble-weather-typescript/' },
    transport: 'the platform fetch (browsers, Node.js and other runtimes with fetch)',
    page: '/weather-api/javascript/',
  },
  {
    slug: 'go',
    label: 'Go',
    hl: 'go',
    repoName: 'ensemble-weather-go',
    refKey: 'go',
    package: 'oureawx.com/go/ensemble-weather (package ensembleweather)',
    install: 'go get oureawx.com/go/ensemble-weather',
    registry: { name: 'pkg.go.dev', url: 'https://pkg.go.dev/oureawx.com/go/ensemble-weather' },
    reference: { name: 'pkg.go.dev', url: 'https://pkg.go.dev/oureawx.com/go/ensemble-weather' },
    transport: 'net/http from the standard library',
    page: '/weather-api/go/',
  },
  {
    slug: 'csharp',
    label: 'C#',
    hl: 'csharp',
    repoName: 'ensemble-weather-dotnet',
    refKey: 'dotnet',
    package: 'EnsembleWeather on NuGet (namespace EnsembleWeather)',
    install: 'dotnet add package EnsembleWeather',
    registry: { name: 'NuGet', url: 'https://www.nuget.org/packages/EnsembleWeather' },
    // DocFX, built from the SDK's docs/docfx.json and published with GitHub Pages.
    reference: { name: 'DocFX', url: 'https://ourea-technologies.github.io/ensemble-weather-dotnet/' },
    transport: 'HttpClient and System.Text.Json',
    page: '/weather-api/csharp/',
  },
  {
    slug: 'java',
    label: 'Java',
    hl: 'java',
    repoName: 'ensemble-weather-java',
    refKey: 'java',
    package: 'com.oureawx:ensemble-weather (module com.oureawx.ensembleweather)',
    install: 'implementation("com.oureawx:ensemble-weather:0.1.0")',
    registry: { name: 'Maven Central', url: 'https://central.sonatype.com/artifact/com.oureawx/ensemble-weather' },
    reference: { name: 'javadoc.io', url: 'https://javadoc.io/doc/com.oureawx/ensemble-weather' },
    transport: 'java.net.http from the JDK',
    page: '/weather-api/java/',
  },
  {
    slug: 'kotlin',
    label: 'Kotlin',
    hl: 'kotlin',
    repoName: 'ensemble-weather-kotlin',
    refKey: 'kotlin',
    package: 'com.oureawx:ensemble-weather-kotlin (package com.oureawx.ensembleweather.kotlin)',
    install: 'implementation("com.oureawx:ensemble-weather-kotlin:0.1.0")',
    registry: { name: 'Maven Central', url: 'https://central.sonatype.com/artifact/com.oureawx/ensemble-weather-kotlin' },
    reference: { name: 'javadoc.io', url: 'https://javadoc.io/doc/com.oureawx/ensemble-weather-kotlin' },
    transport: 'kotlinx-coroutines and kotlinx-serialization are the allowed runtime dependencies',
    page: '/weather-api/kotlin/',
  },
  {
    slug: 'swift',
    label: 'Swift',
    hl: 'swift',
    repoName: 'ensemble-weather-swift',
    refKey: 'swift',
    package: 'SwiftPM product EnsembleWeather',
    install: '.package(url: "https://github.com/Ourea-Technologies/ensemble-weather-swift", from: "0.1.0")',
    registry: { name: 'Swift Package Index', url: 'https://swiftpackageindex.com/Ourea-Technologies/ensemble-weather-swift' },
    reference: { name: 'Swift Package Index', url: 'https://swiftpackageindex.com/Ourea-Technologies/ensemble-weather-swift' },
    transport: 'URLSession',
    page: '/weather-api/swift/',
  },
  {
    slug: 'dart',
    label: 'Dart',
    hl: 'dart',
    repoName: 'ensemble-weather-dart',
    refKey: 'dart',
    package: 'ensemble_weather on pub.dev (import package:ensemble_weather/ensemble_weather.dart)',
    install: 'dart pub add ensemble_weather',
    registry: { name: 'pub.dev', url: 'https://pub.dev/packages/ensemble_weather' },
    reference: { name: 'pub.dev API docs', url: 'https://pub.dev/documentation/ensemble_weather/latest/' },
    transport: 'package:http, the one runtime dependency (Flutter on Android, iOS, desktop and web, and the Dart VM)',
    page: '/weather-api/dart/',
  },
  {
    slug: 'r',
    label: 'R',
    hl: 'r',
    repoName: 'ensemble-weather-r',
    refKey: 'r',
    package: 'ensembleweather on CRAN (library(ensembleweather))',
    install: 'install.packages("ensembleweather")',
    registry: { name: 'CRAN', url: 'https://cran.r-project.org/package=ensembleweather' },
    reference: { name: 'pkgdown', url: 'https://ourea-technologies.github.io/ensemble-weather-r/' },
    transport: 'httr2 (with cli and jsonlite)',
    page: '/weather-api/r/',
  },
  {
    slug: 'rust',
    label: 'Rust',
    hl: 'rust',
    repoName: 'ensemble-weather-rust',
    refKey: 'rust',
    package: 'ensemble-weather on crates.io (crate ensemble_weather)',
    install: 'cargo add ensemble-weather',
    registry: { name: 'crates.io', url: 'https://crates.io/crates/ensemble-weather' },
    reference: { name: 'docs.rs', url: 'https://docs.rs/ensemble-weather' },
    transport: 'reqwest with rustls on Tokio; a blocking client behind the `blocking` feature',
    page: '/weather-api/rust/',
  },
];

for (const s of SDKS) {
  s.repo = `https://github.com/Ourea-Technologies/${s.repoName}`;
}

export const ALL = [...TRANSPORTS, ...SDKS];

/** ?lang= aliases a reader might type. */
export const ALIASES = { dotnet: 'csharp', cs: 'csharp', ts: 'typescript', js: 'typescript', javascript: 'typescript', node: 'typescript', flutter: 'dart', rs: 'rust', rlang: 'r', rest: 'curl', http: 'curl', 'capn-proto': 'capnp' };
