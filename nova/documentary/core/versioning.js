'use strict';

/**
 * §31 — PROJECT VERSIONING. Mỗi stage pipeline có version + snapshot để rollback.
 * Không overwrite state mà không có version. Snapshot lưu trong project file,
 * giới hạn kích thước để không phình.
 */

const MAX_SNAPSHOTS = 12;

function createVersioning(store) {
  function ensureContainer(project) {
    project.versions = Array.isArray(project.versions) ? project.versions : [];
    project.stageVersions = project.stageVersions && typeof project.stageVersions === 'object' ? project.stageVersions : {};
    return project;
  }

  function versionFor(project, stage) {
    const current = Number(project.stageVersions[stage]) || 0;
    return current + 1;
  }

  return {
    /** Lưu snapshot stage: cắt bớt snapshot cũ khi vượt MAX_SNAPSHOTS. */
    commit(project, stage, { note } = {}) {
      ensureContainer(project);
      const version = versionFor(project, stage);
      project.stageVersions[stage] = version;
      // Snapshot KHÔNG chứa chính mảng versions — nếu không, mỗi snapshot nhúng
      // tất cả snapshot cũ → kích thước tăng cấp số nhân (§31 "giới hạn kích thước").
      const snapshot = JSON.parse(JSON.stringify(project));
      snapshot.versions = [];
      project.versions.push({
        stage: String(stage),
        version,
        at: new Date().toISOString(),
        note: note || null,
        snapshot,
      });
      while (project.versions.length > MAX_SNAPSHOTS) project.versions.shift();
      return { stage, version };
    },
    list(project) {
      ensureContainer(project);
      return project.versions.map(({ stage, version, at, note }) => ({ stage, version, at, note }));
    },
    /** Rollback về snapshot (stage, version) gần nhất khớp. Trả project cũ hoặc null. */
    rollback(project, stage, version) {
      ensureContainer(project);
      const index = [...project.versions].reverse().findIndex(item => item.stage === stage && (version === undefined || item.version === version));
      if (index < 0) return null;
      const entry = project.versions[project.versions.length - 1 - index];
      const restored = JSON.parse(JSON.stringify(entry.snapshot));
      ensureContainer(restored);
      restored.versions = project.versions.slice(0, project.versions.indexOf(entry) + 1);
      return restored;
    },
  };
}

module.exports = { createVersioning, MAX_SNAPSHOTS };