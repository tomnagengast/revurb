/**
 * Certificate resolver for SSL/TLS certificates
 * Searches Laravel Herd and Valet certificate directories for SSL certificates
 *
 * @module certificate
 */

import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, sep } from "node:path";

/**
 * Get the Laravel Herd certificate directory path
 *
 * Returns platform-specific path to Herd's certificate directory:
 * - macOS: ~/Library/Application Support/Herd/config/valet/Certificates/
 * - Windows: %USERPROFILE%\.config\herd\config\valet\Certificates\
 * - Linux: ~/.config/herd/config/valet/Certificates/
 *
 * @returns Full path to Herd certificates directory with trailing separator
 *
 * @example
 * ```typescript
 * const herdPath = certificateHerdPath();
 * // macOS: '/Users/username/Library/Application Support/Herd/config/valet/Certificates/'
 * ```
 */
function certificateHerdPath(): string {
  const home = homedir();
  const os = platform();

  if (os === "win32") {
    // Windows: %USERPROFILE%\.config\herd\config\valet\Certificates\
    return (
      join(home, ".config", "herd", "config", "valet", "Certificates", "") + sep
    );
  }

  // macOS: ~/Library/Application Support/Herd/config/valet/Certificates/
  if (os === "darwin") {
    return (
      join(
        home,
        "Library",
        "Application Support",
        "Herd",
        "config",
        "valet",
        "Certificates",
        "",
      ) + sep
    );
  }

  // Linux/other: ~/.config/herd/config/valet/Certificates/
  return (
    join(home, ".config", "herd", "config", "valet", "Certificates", "") + sep
  );
}

/**
 * Get the Laravel Valet certificate directory path
 *
 * Returns path to Valet's certificate directory:
 * ~/.config/valet/Certificates/
 *
 * @returns Full path to Valet certificates directory with trailing separator
 *
 * @example
 * ```typescript
 * const valetPath = certificateValetPath();
 * // Returns '/Users/username/.config/valet/Certificates/'
 * ```
 */
function certificateValetPath(): string {
  const home = homedir();
  return join(home, ".config", "valet", "Certificates", "") + sep;
}

/**
 * Get all certificate search paths
 *
 * @returns Array of directory paths to search for certificates
 *
 * @example
 * ```typescript
 * const paths = certificatePaths();
 * // Returns ['/Users/username/Library/Application Support/Herd/...', ...]
 * ```
 */
function certificatePaths(): string[] {
  return [certificateHerdPath(), certificateValetPath()];
}

/**
 * Resolve the certificate and key paths for the given URL
 *
 * Extracts the hostname from the URL and searches configured certificate
 * directories for matching .crt and .key files
 *
 * @param url - The URL to resolve certificates for
 * @returns Tuple of [certPath, keyPath] if found, null otherwise
 *
 * @example
 * ```typescript
 * const paths = certificateResolve('https://myapp.test');
 * if (paths) {
 *   const [certPath, keyPath] = paths;
 *   console.log(`Cert: ${certPath}, Key: ${keyPath}`);
 * }
 * ```
 */
function certificateResolve(url: string): [string, string] | null {
  // Extract hostname from URL, fallback to url if parsing fails
  let host: string;
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
  } catch {
    // If URL parsing fails, assume url is already a hostname
    host = url;
  }

  const certificate = `${host}.crt`;
  const key = `${host}.key`;

  // Search all configured certificate paths
  for (const path of certificatePaths()) {
    const certPath = join(path, certificate);
    const keyPath = join(path, key);

    if (existsSync(certPath) && existsSync(keyPath)) {
      return [certPath, keyPath];
    }
  }

  return null;
}

/**
 * Determine if a certificate exists for the given URL
 *
 * @param url - The URL to check for certificates
 * @returns True if both certificate and key files exist
 *
 * @example
 * ```typescript
 * const hasSSL = certificateExists('https://myapp.test');
 * // Returns true if myapp.test.crt and myapp.test.key exist
 * ```
 */
function certificateExists(url: string): boolean {
  return certificateResolve(url) !== null;
}

/**
 * Certificate utility functions for resolving SSL certificates
 * Provides functions to locate and validate SSL certificate files
 */
export const Certificate = {
  exists: certificateExists,
  resolve: certificateResolve,
  paths: certificatePaths,
  herdPath: certificateHerdPath,
  valetPath: certificateValetPath,
};
