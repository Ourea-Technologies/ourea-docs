// SPDX-License-Identifier: BSD-2-Clause
// Copyright (c) 2026 Ourea Technologies
//
// The request builder's "same call in every language": each language's
// standard HTTP client fetching the canonical URL, the way the tested no-SDK
// quickstarts in examples/http/ do. Only the URL changes; nothing is parsed
// or computed. Runs in the browser.

const capnpUrl = (url) => {
  const u = new URL(url);
  const params = [...u.searchParams.keys()];
  // format sorts among the other names (BEHAVIOR.md 3.1); keep the rest as built.
  const pairs = u.search.slice(1) ? u.search.slice(1).split('&') : [];
  const at = params.filter((p) => p < 'format').length;
  pairs.splice(at, 0, 'format=capnp');
  return `${u.origin}${u.pathname}?${pairs.join('&')}`;
};

/** slug -> (url) => code. Slugs and order match the site's language switcher. */
export const SNIPPETS = {
  curl: (url) => `curl -sS --fail-with-body --compressed "${url}"`,
  capnp: (url) => `curl -sS --fail-with-body --compressed "${capnpUrl(url)}" \\\n  | capnp decode ourea.capnp ForecastResponse`,
  python: (url) => `import json
import urllib.request

URL = "${url}"
with urllib.request.urlopen(URL) as response:
    forecast = json.load(response)
print(forecast["location"]["name"], forecast.get("probabilities"))`,
  typescript: (url) => `const response = await fetch("${url}");
if (!response.ok) throw new Error(\`HTTP \${response.status}: \${await response.text()}\`);
const forecast = await response.json();
console.log(forecast.location.name, forecast.probabilities);`,
  go: (url) => `package main

import (
	"fmt"
	"io"
	"net/http"
)

func main() {
	resp, err := http.Get("${url}")
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	fmt.Println(resp.Status, string(body))
}`,
  csharp: (url) => `using var http = new HttpClient();
var json = await http.GetStringAsync("${url}");
Console.WriteLine(json);`,
  java: (url) => `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class Forecast {
    public static void main(String[] args) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("${url}")).build();
        var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.statusCode() + " " + response.body());
    }
}`,
  kotlin: (url) => `import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

fun main() {
    val request = HttpRequest.newBuilder(URI.create("${url}")).build()
    val response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString())
    println("\${response.statusCode()} \${response.body()}")
}`,
  swift: (url) => `import Foundation

let url = URL(string: "${url}")!
let (data, response) = try await URLSession.shared.data(from: url)
print((response as? HTTPURLResponse)?.statusCode ?? 0, String(decoding: data, as: UTF8.self))`,
  dart: (url) => `import 'package:http/http.dart' as http;

Future<void> main() async {
  final response = await http.get(Uri.parse('${url}'));
  print('\${response.statusCode} \${response.body}');
}`,
  r: (url) => `forecast <- jsonlite::fromJSON("${url}")
str(forecast$probabilities)`,
  rust: (url) => `// Cargo.toml: reqwest = "0.13", tokio = { version = "1", features = ["full"] }
#[tokio::main]
async fn main() -> Result<(), reqwest::Error> {
    let body = reqwest::get("${url}").await?.text().await?;
    println!("{body}");
    Ok(())
}`,
};
