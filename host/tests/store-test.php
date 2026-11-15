<?php
/**
 * Checks the package store without touching the live data directory.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

declare(strict_types=1);

require dirname(__DIR__) . '/src/Store.php';

$root = sys_get_temp_dir() . '/tepuy-host-' . bin2hex(random_bytes(4));
$keep = $root . '-keep';
register_shutdown_function(static function () use ($root, $keep): void {
    foreach ([$root, $keep] as $dir) {
        if (!is_dir($dir)) {
            continue;
        }
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $item) {
            $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
        rmdir($dir);
    }
});
$store = new TepuyStore($root, ['id' => 'dev', 'name' => 'Desarrollo'], 64, 0);

function check(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL {$message}\n");
        exit(1);
    }
}

function fails(callable $action, string $error): void
{
    try {
        $action();
    } catch (TepuyHostException $exception) {
        check($exception->error === $error, "expected {$error}, got {$exception->error}");
        return;
    }
    check(false, "expected {$error}");
}

$created = $store->create('Paquete demo', 'base');
check($created['revision'] === '0', 'create starts at revision 0');
check($store->open($created['ref'])['name'] === 'Paquete demo', 'open returns the name');

$committed = $store->commit($created['ref'], [
    ['op' => 'write', 'path' => 'content.html', 'content' => "<main>uno</main>\n"],
    ['op' => 'mkdir', 'path' => 'content/media'],
    ['op' => 'write', 'path' => 'custom/lang.js', 'content' => 'export const lang = {};'],
], '0');
check($committed['revision'] === '1', 'commit advances the revision');
check($store->read($created['ref'], 'content.html')['content'] === "<main>uno</main>\n", 'read returns the file');

fails(
    fn () => $store->commit($created['ref'], [
        ['op' => 'write', 'path' => 'content.html', 'content' => 'dos'],
    ], '0'),
    'conflict'
);
check($store->read($created['ref'], 'content.html')['content'] === "<main>uno</main>\n", 'conflict keeps the previous file');

fails(fn () => $store->read($created['ref'], '../secret'), 'invalid');
fails(fn () => $store->read($created['ref'], '/etc/passwd'), 'invalid');
fails(fn () => $store->commit($created['ref'], [
    ['op' => 'write', 'path' => 'content/../../outside.txt', 'content' => 'no'],
], '1'), 'invalid');
fails(fn () => $store->commit($created['ref'], [
    ['op' => 'write', 'path' => 'tepuy/app.js', 'content' => 'no'],
    ['op' => 'write', 'path' => 'content.html', 'content' => 'should-not-land'],
], '1'), 'invalid');
check($store->read($created['ref'], 'content.html')['content'] === "<main>uno</main>\n", 'rejected commit writes nothing');

fails(fn () => $store->commit($created['ref'], [
    ['op' => 'write', 'path' => 'content.html', 'content' => str_repeat('x', 65)],
], '1'), 'too_large');

$upload = $store->tempUpload($created['ref'], 'Foto.PNG', 'png-bytes');
check($upload['path'] === 'content/foto.png', 'upload name is normalized');
$withFile = $store->commit($created['ref'], [
    ['op' => 'write', 'path' => $upload['path'], 'tempId' => $upload['tempId']],
], '1');
check($withFile['revision'] === '2', 'adopting an upload advances the revision');
check($store->read($created['ref'], 'content/foto.png')['content'] === 'png-bytes', 'upload lands in content');

$store->appendLog($created['ref'], [[
    'timestamp' => '2020-01-01T00:00:00+00:00',
    'operation' => 'save',
    'targetId' => 'content.html',
    'summary' => 'secret-log-line',
]]);
$store->appendLog($created['ref'], [[
    'operation' => 'add',
    'targetId' => 'quiz',
    'summary' => 'Quiz',
]]);
$saved = $store->listLog($created['ref'], ['operation' => 'save']);
check(count($saved) === 1 && $saved[0]['summary'] === 'secret-log-line', 'log filters by operation');
check($saved[0]['user']['id'] === 'dev', 'log stamps the host user');
check(!str_contains($store->read($created['ref'], 'content.html')['content'], 'secret-log-line'), 'log stays out of the package');
$today = $store->listLog($created['ref'], ['from' => gmdate('Y-m-d'), 'to' => gmdate('Y-m-d')]);
check(count($today) === 1 && $today[0]['operation'] === 'add', 'date filter keeps today');

$zip = $store->download($created['ref']);
check(str_contains($zip, 'content.html') && !str_contains($zip, 'log.jsonl'), 'download includes files and omits the log');
check(!str_contains($zip, 'secret-log-line'), 'download omits log text');

$short = new TepuyStore($keep, ['id' => 'dev', 'name' => 'Desarrollo'], 1024, 1);
$kept = $short->create('Viejo', 'base');
$short->appendLog($kept['ref'], [[
    'timestamp' => '2000-01-01T00:00:00+00:00',
    'operation' => 'save',
    'summary' => 'old',
]]);
check($short->listLog($kept['ref']) === [], 'retention drops expired entries');

echo "ok\n";
