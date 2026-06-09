/**
 * D-Bus integration for unprivileged systemd shutdown via org.freedesktop.login1.
 * Requires the power-agent user to have polkit permission for:
 *   org.freedesktop.login1.power-off
 *
 * On non-Linux platforms (dev), this module is a no-op stub.
 */

// dbus-next is an optional Linux-only dep — loaded at runtime, no @types available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbusModule: Record<string, any> | null = null;

async function tryLoadDbus() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    dbusModule = require('dbus-next') as Record<string, unknown>;
  } catch {
    console.warn('[DBus] dbus-next not available — systemd integration disabled (dev mode)');
  }
}

export async function triggerShutdown(): Promise<void> {
  await tryLoadDbus();

  if (!dbusModule) {
    console.log('[DBus] STUB: would call org.freedesktop.login1.Manager.PowerOff(false)');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const bus = dbusModule['systemBus']();
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const obj = await bus.getProxyObject('org.freedesktop.login1', '/org/freedesktop/login1');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const manager = obj.getInterface('org.freedesktop.login1.Manager');
    // interactive=false: non-interactive, polkit handles auth
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await manager.PowerOff(false);
    console.log('[DBus] PowerOff command sent');
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    bus.disconnect();
  }
}
