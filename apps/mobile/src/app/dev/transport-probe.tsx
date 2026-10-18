/**
 * Dev-only transport probe (step 2 spike). Run it on a real iOS and Android
 * device to confirm that the app's Fetch keeps cookies out of the native
 * jars, exposes Set-Cookie on 3xx responses, and logs in to HUNGU and the
 * school portal. Nothing is persisted: sessions live in memory only.
 */
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { fetch as expoFetch } from 'expo/fetch';
import { Screen, Text } from '@altuu/ui';
import {
  HunguClient,
  HttpTransport,
  SchoolPortalProxyClient,
  defaultHunguConfig,
  defaultSchoolPortalConfig,
  resolveHunguBaseUrl,
  type Fetch,
  type HunguSession,
  type SchoolPortalSession,
  type SessionStore,
} from '@altuu/core';

import { fetch as appFetch } from '../../platform/fetch';
import { globalFetch } from '../../platform/fetch.global';

type Implementation = 'expo' | 'global';

class MemoryStore<T> implements SessionStore<T> {
  private session: T | null = null;

  async get(): Promise<T | null> {
    return this.session;
  }

  async put(session: T): Promise<void> {
    this.session = session;
  }

  async clear(): Promise<void> {
    this.session = null;
  }
}

const mask = (value: string): string =>
  value.length <= 6 ? value : `${value.slice(0, 6)}…(${value.length})`;

const describeCookieHeader = (header: string | undefined): string =>
  header === undefined || header === ''
    ? '(none)'
    : header
        .split('; ')
        .map((pair) => {
          const [name, ...rest] = pair.split('=');

          return `${name}=${mask(rest.join('='))}`;
        })
        .join('; ');

/** Wraps a Fetch so every hop logs what was sent and received. */
function instrument(base: Fetch, log: (line: string) => void): Fetch {
  return async (url, init = {}) => {
    const cookie = Object.entries(init.headers ?? {}).find(
      ([name]) => name.toLowerCase() === 'cookie',
    )?.[1];

    log(
      `→ ${init.method ?? 'GET'} ${url} [redirect=${init.redirect ?? 'follow'}]`,
    );
    log(`   Cookie sent: ${describeCookieHeader(cookie)}`);

    const response = await base(url, init);
    const setCookies = response.setCookies();

    log(
      `← ${response.status} location=${response.headers.get('location') ?? '-'}`,
    );
    log(
      `   Set-Cookie (${setCookies.length}): ${
        setCookies
          .map((value) => describeCookieHeader(value.split(';')[0]))
          .join(' | ') || '(none)'
      }`,
    );

    return response;
  };
}

function TransportProbe() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [echoBase, setEchoBase] = useState('https://httpbin.org');
  const [implementation, setImplementation] = useState<Implementation>('expo');
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const log = useCallback(
    (line: string) => setLines((current) => [...current, line]),
    [],
  );

  const run = useCallback(
    async (title: string, work: (fetch: Fetch) => Promise<void>) => {
      setBusy(true);
      log(`\n=== ${title} (${implementation}) ===`);

      try {
        await work(
          instrument(implementation === 'expo' ? appFetch : globalFetch, log),
        );
        log('✓ done');
      } catch (error) {
        log(
          `✗ ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
        );

        if (error instanceof Error && error.cause !== undefined) {
          log(`   cause: ${String(error.cause)}`);
        }
      } finally {
        setBusy(false);
      }
    },
    [implementation, log],
  );

  const hunguLogin = () =>
    run('HUNGU login + authenticated request', async (fetch) => {
      const store = new MemoryStore<HunguSession>();
      const client = new HunguClient({
        fetch,
        sessionStore: store,
        config: { ...defaultHunguConfig, debug: true },
      });
      const baseUrl = resolveHunguBaseUrl(defaultHunguConfig, username);
      const result = await client.login(
        baseUrl,
        defaultHunguConfig.userAgent,
        username,
        password,
      );
      const data = (result.payload.data ?? {}) as Record<
        string,
        Record<string, unknown>
      >;

      log(
        `login code=${String(result.payload.code)} message=${String(result.payload.message ?? '')}`,
      );
      log(
        `jar after login: ${Object.keys(result.cookies).join(', ') || '(empty)'}`,
      );

      if (result.payload.code !== 0) {
        return;
      }

      await store.put({
        baseUrl,
        userAgent: defaultHunguConfig.userAgent,
        cookies: result.cookies,
        ticket: String(data.session_data?.ticket ?? ''),
        session_idx: String(data.idx_data?.session_idx ?? ''),
      });

      const profile = await client.request('my-profile', {
        canRetryOnForbidden: false,
      });
      log(`my-profile code=${String(profile.payload.code)}`);

      const courses = await client.request('my-course-list', {
        params: { offset: 0, pagesize: 100 },
        canRetryOnForbidden: false,
      });
      log(`my-course-list code=${String(courses.payload.code)}`);

      const page = await client.fetchCoursePathTree();
      log(`pathtree page status=${page.status} bytes=${page.body.length}`);
      log(
        `jar now: ${Object.keys((await store.get())?.cookies ?? {}).join(', ')}`,
      );
    });

  const portalLogin = () =>
    run('School portal login (cookie on 302)', async (fetch) => {
      const store = new MemoryStore<SchoolPortalSession>();
      const proxy = new SchoolPortalProxyClient({
        fetch,
        sessionStore: store,
        credentialsStore: {
          get: async () => null,
          put: async () => {},
        },
        config: defaultSchoolPortalConfig,
      });

      log(`portal login ok=${String(await proxy.login(username, password))}`);
      log(
        `jar: ${Object.keys((await store.get())?.cookies ?? {}).join(', ') || '(empty)'}`,
      );
    });

  const redirectProbe = () =>
    run(
      'Redirect + Set-Cookie on 3xx + native jar isolation',
      async (fetch) => {
        const transport = new HttpTransport({
          fetch,
          service: 'probe',
        });
        const setUrl = `${echoBase}/cookies/set?probe_cookie=from_302`;

        const manual = await transport.send({
          method: 'GET',
          url: setUrl,
          followRedirects: false,
        });
        log(
          `manual: status=${manual.status} (expect 302) setCookies=${manual.setCookies.length} (expect 1)`,
        );

        const followed = await transport.send({
          method: 'GET',
          url: setUrl,
          cookies: { explicit: 'from_core' },
        });
        log(
          `followed: status=${followed.status} hops=${followed.redirectCount}`,
        );
        log(`server saw: ${followed.body.replace(/\s+/g, ' ')}`);
        log('   expect explicit + probe_cookie, nothing else');

        const multi = await transport.send({
          method: 'GET',
          url: `${echoBase}/response-headers?Set-Cookie=a%3D1&Set-Cookie=b%3D2%3B%20Expires%3DWed%2C%2021%20Oct%202099%2007%3A28%3A00%20GMT`,
        });
        log(`multi: ${JSON.stringify(multi.setCookies)} (expect 2 entries)`);

        // Did any of the above leak into the shared native cookie store?
        const leakCheck = await expoFetch(`${echoBase}/cookies`, {
          credentials: 'include',
        });
        log(
          `native jar (expo/fetch include): ${(await leakCheck.text()).replace(/\s+/g, ' ')}`,
        );
        const rnLeakCheck = await globalThis.fetch(`${echoBase}/cookies`, {
          credentials: 'include',
        });
        log(
          `native jar (RN fetch include): ${(await rnLeakCheck.text()).replace(/\s+/g, ' ')}`,
        );
        log('   expect {"cookies": {}} for both when nothing leaked');
      },
    );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-xl font-bold">Transport probe (dev)</Text>
        <TextInput
          className="rounded border border-theme-300 p-2 text-theme-900 dark:text-theme-100"
          placeholder="帳號"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          className="rounded border border-theme-300 p-2 text-theme-900 dark:text-theme-100"
          placeholder="密碼"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          className="rounded border border-theme-300 p-2 text-theme-900 dark:text-theme-100"
          placeholder="Echo server"
          autoCapitalize="none"
          value={echoBase}
          onChangeText={setEchoBase}
        />
        <View className="flex-row flex-wrap gap-2">
          <ProbeButton
            label={`Fetch: ${implementation}`}
            onPress={() =>
              setImplementation(implementation === 'expo' ? 'global' : 'expo')
            }
            disabled={busy}
          />
          <ProbeButton
            label="HUNGU login"
            onPress={hunguLogin}
            disabled={busy || username === ''}
          />
          <ProbeButton
            label="Portal login"
            onPress={portalLogin}
            disabled={busy || username === ''}
          />
          <ProbeButton
            label="Redirect probe"
            onPress={redirectProbe}
            disabled={busy}
          />
          <ProbeButton
            label="Clear"
            onPress={() => setLines([])}
            disabled={busy}
          />
        </View>
        <Text selectable className="font-mono text-xs">
          {lines.join('\n')}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function ProbeButton(props: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      className="rounded bg-theme-600 px-3 py-2 disabled:opacity-50"
      onPress={props.onPress}
      disabled={props.disabled}
    >
      <Text className="text-white">{props.label}</Text>
    </Pressable>
  );
}

export default function TransportProbeRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <TransportProbe />;
}
