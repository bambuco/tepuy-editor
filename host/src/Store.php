<?php
/**
 * Disk store for Tepuy packages and their change log.
 *
 * Packages live in {root}/{ref}/files. The log is {root}/{ref}/log.jsonl
 * and is never part of the package download.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

declare(strict_types=1);

/**
 * Typed failure of a host operation.
 */
class TepuyHostException extends RuntimeException
{
    /**
     * @param string $error conflict, forbidden, not_found, too_large, or invalid.
     * @param string $message Short explanation.
     */
    public function __construct(public readonly string $error, string $message)
    {
        parent::__construct($message);
    }
}

/**
 * Package files, revisions, uploads, and the JSONL log.
 */
class TepuyStore
{
    private string $root;

    /** @var array{id: string, name: string} */
    private array $user;

    private int $maxBytes;

    private int $retentionDays;

    /** @var list<string> */
    private array $uploadExtensions = [
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
        'mp3', 'ogg', 'wav', 'mp4', 'webm', 'pdf', 'vtt',
    ];

    /** @var list<string> */
    private array $operations = [
        'add', 'move', 'delete', 'duplicate', 'theme', 'settings',
        'save', 'upload', 'create', 'custom', 'import', 'export',
    ];

    /**
     * @param array{id?: string, name?: string} $user Identity stamped on log entries.
     */
    public function __construct(string $root, array $user = [], int $maxBytes = 2097152, int $retentionDays = 0)
    {
        if (!is_dir($root) && !mkdir($root, 0775, true)) {
            throw new TepuyHostException('invalid', 'Storage root is not available.');
        }
        $real = realpath($root);
        if ($real === false) {
            throw new TepuyHostException('invalid', 'Storage root is not available.');
        }
        $this->root = $real;
        $this->user = [
            'id' => (string) ($user['id'] ?? 'dev'),
            'name' => (string) ($user['name'] ?? 'Desarrollo'),
        ];
        $this->maxBytes = $maxBytes;
        $this->retentionDays = $retentionDays;
    }

    /**
     * @return array<string, bool> Operations this host implements.
     */
    public function capabilities(): array
    {
        return [
            'revision' => true,
            'conflict' => true,
            'tempUpload' => true,
            'download' => true,
            'log' => true,
            'previewUrl' => false,
        ];
    }

    /**
     * @return array{id: string, name: string} Authenticated user.
     */
    public function getUser(): array
    {
        return $this->user;
    }

    /**
     * @return array{ref: string, name: string, themeId: string, revision: string} New package at revision 0.
     */
    public function create(string $name, string $themeId): array
    {
        $name = trim($name);
        if ($name === '' || strlen($name) > 80) {
            throw new TepuyHostException('invalid', 'Package name rejected.');
        }
        if (!preg_match('/^[a-z0-9][a-z0-9-]{0,40}$/', $themeId)) {
            throw new TepuyHostException('invalid', 'Theme rejected.');
        }
        $ref = $this->uniqueRef($this->slug($name));
        $dir = $this->root . '/' . $ref;
        if (!mkdir($dir, 0775) || !mkdir($dir . '/files', 0775) || !mkdir($dir . '/tmp', 0775)) {
            throw new TepuyHostException('invalid', 'Package directory was not created.');
        }
        $meta = ['name' => $name, 'themeId' => $themeId, 'created' => gmdate('c')];
        file_put_contents($dir . '/meta.json', json_encode($meta, JSON_UNESCAPED_UNICODE));
        file_put_contents($dir . '/revision', '0');
        return ['ref' => $ref, 'name' => $name, 'themeId' => $themeId, 'revision' => '0'];
    }

    /**
     * @return array{ref: string, name: string, themeId: string, revision: string} Package metadata.
     */
    public function open(string $ref): array
    {
        $dir = $this->packageDir($ref);
        $meta = $this->readMeta($dir);
        return [
            'ref' => $ref,
            'name' => $meta['name'],
            'themeId' => $meta['themeId'],
            'revision' => $this->readRevision($dir),
        ];
    }

    /**
     * @return list<array{ref: string, name: string, themeId: string, revision: string}> Packages on disk.
     */
    public function listPackages(): array
    {
        $packages = [];
        foreach (scandir($this->root) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..' || !is_file($this->root . '/' . $entry . '/meta.json')) {
                continue;
            }
            $packages[] = $this->open($entry);
        }
        usort($packages, fn (array $left, array $right) => strcmp($left['name'], $right['name']));
        return $packages;
    }

    /**
     * @return list<array{path: string, type: string, size: int}> Files stored for the package.
     */
    public function listFiles(string $ref): array
    {
        $files = $this->packageDir($ref) . '/files';
        $found = [];
        if (!is_dir($files)) {
            return $found;
        }
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($files, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($iterator as $item) {
            $path = substr($item->getPathname(), strlen($files) + 1);
            $found[] = [
                'path' => str_replace('\\', '/', $path),
                'type' => $item->isDir() ? 'dir' : 'file',
                'size' => $item->isFile() ? $item->getSize() : 0,
            ];
        }
        usort($found, fn (array $left, array $right) => strcmp($left['path'], $right['path']));
        return $found;
    }

    /**
     * @return array{path: string, encoding: string, content: string} File bytes as text or base64.
     */
    public function read(string $ref, string $path): array
    {
        $relative = $this->writablePath($path);
        $full = $this->packageDir($ref) . '/files/' . $relative;
        if (!is_file($full)) {
            throw new TepuyHostException('not_found', 'File not found.');
        }
        $bytes = file_get_contents($full);
        if ($bytes === false) {
            throw new TepuyHostException('invalid', 'File could not be read.');
        }
        if (str_contains($bytes, "\0") || !mb_check_encoding($bytes, 'UTF-8')) {
            return ['path' => $relative, 'encoding' => 'base64', 'content' => base64_encode($bytes)];
        }
        return ['path' => $relative, 'encoding' => 'utf-8', 'content' => $bytes];
    }

    /**
     * Applies every change or none, when baseRevision is still current.
     *
     * @param list<array<string, mixed>> $changes write, delete, mkdir, or move.
     * @return array{revision: string} Revision after the commit.
     */
    public function commit(string $ref, array $changes, string $baseRevision): array
    {
        $dir = $this->packageDir($ref);
        $lock = $this->lock($dir);
        $stage = '';
        try {
            $current = $this->readRevision($dir);
            if ($baseRevision !== $current) {
                throw new TepuyHostException('conflict', 'Revision mismatch.');
            }
            $this->validateChanges($dir, $changes);
            $stage = $dir . '/stage-' . bin2hex(random_bytes(4));
            $this->copyTree($dir . '/files', $stage);
            foreach ($changes as $change) {
                $this->applyChange($dir, $stage, $change);
            }
            $previous = $dir . '/files.prev';
            if (is_dir($previous)) {
                $this->removeTree($previous);
            }
            if (!rename($dir . '/files', $previous)) {
                throw new TepuyHostException('invalid', 'Package files could not be swapped.');
            }
            if (!rename($stage, $dir . '/files')) {
                rename($previous, $dir . '/files');
                throw new TepuyHostException('invalid', 'Package files could not be published.');
            }
            $stage = '';
            $this->removeTree($previous);
            foreach ($changes as $change) {
                if (($change['op'] ?? '') === 'write' && isset($change['tempId'])) {
                    $temp = $dir . '/tmp/' . $change['tempId'];
                    if (is_file($temp)) {
                        unlink($temp);
                    }
                }
            }
            $next = (string) ((int) $current + 1);
            file_put_contents($dir . '/revision', $next);
            return ['revision' => $next];
        } catch (TepuyHostException $error) {
            if ($stage !== '' && is_dir($stage)) {
                $this->removeTree($stage);
            }
            throw $error;
        } finally {
            $this->unlock($lock);
        }
    }

    /**
     * Stores an upload outside the package until a commit adopts it.
     *
     * @return array{tempId: string, path: string, name: string} Temporary file and suggested path.
     */
    public function tempUpload(string $ref, string $name, string $bytes): array
    {
        $dir = $this->packageDir($ref);
        if (strlen($bytes) > $this->maxBytes) {
            throw new TepuyHostException('too_large', 'Upload exceeds the size limit.');
        }
        $safe = $this->fileName($name);
        $extension = strtolower(pathinfo($safe, PATHINFO_EXTENSION));
        if (!in_array($extension, $this->uploadExtensions, true)) {
            throw new TepuyHostException('invalid', 'File type rejected.');
        }
        $tempId = bin2hex(random_bytes(8));
        if (file_put_contents($dir . '/tmp/' . $tempId, $bytes) === false) {
            throw new TepuyHostException('invalid', 'Upload was not stored.');
        }
        return ['tempId' => $tempId, 'path' => $this->availableContentPath($dir, $safe), 'name' => $safe];
    }

    /**
     * @return string Zip of the package files. The log stays outside the archive.
     */
    public function download(string $ref): string
    {
        $files = $this->packageDir($ref) . '/files';
        $tmp = tempnam(sys_get_temp_dir(), 'tpy');
        if ($tmp === false) {
            throw new TepuyHostException('invalid', 'Download could not be prepared.');
        }
        $zip = new ZipArchive();
        if ($zip->open($tmp, ZipArchive::OVERWRITE) !== true) {
            throw new TepuyHostException('invalid', 'Download could not be prepared.');
        }
        if (is_dir($files)) {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($files, FilesystemIterator::SKIP_DOTS)
            );
            foreach ($iterator as $item) {
                if ($item->isFile()) {
                    $relative = substr($item->getPathname(), strlen($files) + 1);
                    $zip->addFile($item->getPathname(), str_replace('\\', '/', $relative));
                }
            }
        }
        $zip->close();
        $bytes = file_get_contents($tmp);
        unlink($tmp);
        if ($bytes === false) {
            throw new TepuyHostException('invalid', 'Download could not be prepared.');
        }
        return $bytes;
    }

    /**
     * @param list<array<string, mixed>> $entries Log rows from the editor.
     */
    public function appendLog(string $ref, array $entries): void
    {
        $dir = $this->packageDir($ref);
        $lock = $this->lock($dir);
        try {
            $lines = '';
            foreach ($entries as $entry) {
                if (!is_array($entry)) {
                    throw new TepuyHostException('invalid', 'Log entry rejected.');
                }
                $operation = (string) ($entry['operation'] ?? '');
                if (!in_array($operation, $this->operations, true)) {
                    throw new TepuyHostException('invalid', 'Log operation rejected.');
                }
                $summary = (string) ($entry['summary'] ?? '');
                if ($summary === '' || strlen($summary) > 240) {
                    throw new TepuyHostException('invalid', 'Log summary rejected.');
                }
                $row = [
                    'timestamp' => $this->timestamp((string) ($entry['timestamp'] ?? '')),
                    'user' => $this->user,
                    'packageId' => $ref,
                    'revision' => $this->readRevision($dir),
                    'operation' => $operation,
                    'targetId' => substr((string) ($entry['targetId'] ?? ''), 0, 120),
                    'summary' => $summary,
                ];
                if (isset($entry['details']) && is_string($entry['details'])) {
                    $row['details'] = substr($entry['details'], 0, 240);
                }
                $lines .= json_encode($row, JSON_UNESCAPED_UNICODE) . "\n";
            }
            if ($lines !== '' && file_put_contents($dir . '/log.jsonl', $lines, FILE_APPEND) === false) {
                throw new TepuyHostException('invalid', 'Log was not written.');
            }
        } finally {
            $this->unlock($lock);
        }
    }

    /**
     * @param array{user?: string, operation?: string, from?: string, to?: string} $filter
     * @return list<array<string, mixed>> Matching log entries, oldest first.
     */
    public function listLog(string $ref, array $filter = []): array
    {
        $dir = $this->packageDir($ref);
        $path = $dir . '/log.jsonl';
        if (!is_file($path)) {
            return [];
        }
        $rows = [];
        $cutoff = $this->retentionDays > 0 ? gmdate('c', time() - $this->retentionDays * 86400) : '';
        foreach (file($path, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
            if ($line === '') {
                continue;
            }
            $row = json_decode($line, true);
            if (!is_array($row)) {
                continue;
            }
            if ($cutoff !== '' && (string) ($row['timestamp'] ?? '') < $cutoff) {
                continue;
            }
            if (!$this->matchesLog($row, $filter)) {
                continue;
            }
            $rows[] = $row;
        }
        return $rows;
    }

    /**
     * @param list<array<string, mixed>> $changes Proposed commit.
     */
    private function validateChanges(string $dir, array $changes): void
    {
        foreach ($changes as $change) {
            $op = (string) ($change['op'] ?? '');
            if ($op === 'write') {
                $this->writablePath((string) ($change['path'] ?? ''));
                if (isset($change['tempId'])) {
                    $tempId = (string) $change['tempId'];
                    if (!preg_match('/^[a-f0-9]{16}$/', $tempId) || !is_file($dir . '/tmp/' . $tempId)) {
                        throw new TepuyHostException('invalid', 'Upload was not found.');
                    }
                    if (filesize($dir . '/tmp/' . $tempId) > $this->maxBytes) {
                        throw new TepuyHostException('too_large', 'File exceeds the size limit.');
                    }
                    continue;
                }
                $content = $change['content'] ?? null;
                if (!is_string($content)) {
                    throw new TepuyHostException('invalid', 'File content rejected.');
                }
                if (strlen($content) > $this->maxBytes) {
                    throw new TepuyHostException('too_large', 'File exceeds the size limit.');
                }
                continue;
            }
            if ($op === 'delete' || $op === 'mkdir') {
                $this->writablePath((string) ($change['path'] ?? ''));
                continue;
            }
            if ($op === 'move') {
                $this->writablePath((string) ($change['from'] ?? ''));
                $this->writablePath((string) ($change['to'] ?? ''));
                continue;
            }
            throw new TepuyHostException('invalid', 'Change rejected.');
        }
    }

    /**
     * @param array<string, mixed> $change One validated change.
     */
    private function applyChange(string $dir, string $stage, array $change): void
    {
        $op = (string) $change['op'];
        if ($op === 'write') {
            $target = $stage . '/' . $this->writablePath((string) $change['path']);
            $parent = dirname($target);
            if (!is_dir($parent)) {
                mkdir($parent, 0775, true);
            }
            if (isset($change['tempId'])) {
                copy($dir . '/tmp/' . $change['tempId'], $target);
                return;
            }
            file_put_contents($target, (string) $change['content']);
            return;
        }
        if ($op === 'delete') {
            $target = $stage . '/' . $this->writablePath((string) $change['path']);
            if (is_file($target)) {
                unlink($target);
            } elseif (is_dir($target)) {
                $this->removeTree($target);
            }
            return;
        }
        if ($op === 'mkdir') {
            $target = $stage . '/' . $this->writablePath((string) $change['path']);
            if (!is_dir($target)) {
                mkdir($target, 0775, true);
            }
            return;
        }
        $from = $stage . '/' . $this->writablePath((string) $change['from']);
        $to = $stage . '/' . $this->writablePath((string) $change['to']);
        $parent = dirname($to);
        if (!is_dir($parent)) {
            mkdir($parent, 0775, true);
        }
        rename($from, $to);
    }

    private function availableContentPath(string $dir, string $name): string
    {
        $path = 'content/' . $name;
        $suffix = 2;
        while (is_file($dir . '/files/' . $path)) {
            $extension = pathinfo($name, PATHINFO_EXTENSION);
            $stem = pathinfo($name, PATHINFO_FILENAME);
            $path = 'content/' . $stem . '-' . $suffix . '.' . $extension;
            $suffix++;
        }
        return $path;
    }

    private function fileName(string $name): string
    {
        $base = str_replace('\\', '/', $name);
        $base = basename($base);
        $base = strtolower($base);
        $base = preg_replace('/[^a-z0-9._-]+/', '-', $base) ?? '';
        $base = trim($base, '.-');
        if ($base === '' || $base === '.' || $base === '..') {
            throw new TepuyHostException('invalid', 'File name rejected.');
        }
        return $base;
    }

    private function writablePath(string $path): string
    {
        $relative = $this->relativePath($path);
        $allowed = $relative === 'content.html'
            || $relative === 'index.html'
            || $relative === 'imsmanifest.xml'
            || str_starts_with($relative, 'content/')
            || str_starts_with($relative, 'custom/')
            || str_starts_with($relative, 'theme/');
        if (!$allowed) {
            throw new TepuyHostException('invalid', 'Path rejected.');
        }
        return $relative;
    }

    private function relativePath(string $path): string
    {
        $path = str_replace('\\', '/', $path);
        if ($path === '' || str_contains($path, "\0") || str_starts_with($path, '/')) {
            throw new TepuyHostException('invalid', 'Path rejected.');
        }
        $parts = [];
        foreach (explode('/', $path) as $part) {
            if ($part === '' || $part === '.' || $part === '..') {
                throw new TepuyHostException('invalid', 'Path rejected.');
            }
            $parts[] = $part;
        }
        return implode('/', $parts);
    }

    private function packageDir(string $ref): string
    {
        if (!preg_match('/^[a-z0-9][a-z0-9-]{0,48}$/', $ref)) {
            throw new TepuyHostException('invalid', 'Package reference rejected.');
        }
        $dir = $this->root . '/' . $ref;
        $real = realpath($dir);
        if ($real === false || !str_starts_with($real, $this->root . DIRECTORY_SEPARATOR) || !is_file($real . '/meta.json')) {
            throw new TepuyHostException('not_found', 'Package not found.');
        }
        return $real;
    }

    /**
     * @return array{name: string, themeId: string}
     */
    private function readMeta(string $dir): array
    {
        $meta = json_decode((string) file_get_contents($dir . '/meta.json'), true);
        if (!is_array($meta) || !isset($meta['name'], $meta['themeId'])) {
            throw new TepuyHostException('invalid', 'Package metadata is unreadable.');
        }
        return ['name' => (string) $meta['name'], 'themeId' => (string) $meta['themeId']];
    }

    private function readRevision(string $dir): string
    {
        $revision = trim((string) file_get_contents($dir . '/revision'));
        if (!preg_match('/^\d+$/', $revision)) {
            throw new TepuyHostException('invalid', 'Revision is unreadable.');
        }
        return $revision;
    }

    private function uniqueRef(string $slug): string
    {
        $ref = $slug;
        while (is_dir($this->root . '/' . $ref)) {
            $ref = $slug . '-' . bin2hex(random_bytes(2));
        }
        return $ref;
    }

    private function slug(string $name): string
    {
        $slug = strtolower($name);
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        $slug = trim($slug, '-');
        return $slug === '' ? 'paquete' : substr($slug, 0, 40);
    }

    private function timestamp(string $value): string
    {
        if ($value === '') {
            return gmdate('c');
        }
        $parsed = date_create($value);
        if ($parsed === false) {
            throw new TepuyHostException('invalid', 'Log timestamp rejected.');
        }
        return $parsed->format('c');
    }

    /**
     * @param array<string, mixed> $row Stored entry.
     * @param array{user?: string, operation?: string, from?: string, to?: string} $filter
     */
    private function matchesLog(array $row, array $filter): bool
    {
        $user = strtolower(trim((string) ($filter['user'] ?? '')));
        if ($user !== '') {
            $id = strtolower((string) ($row['user']['id'] ?? ''));
            $name = strtolower((string) ($row['user']['name'] ?? ''));
            if (!str_contains($id, $user) && !str_contains($name, $user)) {
                return false;
            }
        }
        $operation = (string) ($filter['operation'] ?? '');
        if ($operation !== '' && ($row['operation'] ?? '') !== $operation) {
            return false;
        }
        $stamp = (string) ($row['timestamp'] ?? '');
        $from = $this->bound((string) ($filter['from'] ?? ''), false);
        $to = $this->bound((string) ($filter['to'] ?? ''), true);
        if ($from !== '' && $stamp < $from) {
            return false;
        }
        if ($to !== '' && $stamp > $to) {
            return false;
        }
        return true;
    }

    private function bound(string $value, bool $end): string
    {
        if ($value === '') {
            return '';
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return $value . ($end ? 'T23:59:59+00:00' : 'T00:00:00+00:00');
        }
        return $value;
    }

    private function copyTree(string $from, string $to): void
    {
        if (!mkdir($to, 0775, true) && !is_dir($to)) {
            throw new TepuyHostException('invalid', 'Stage directory was not created.');
        }
        if (!is_dir($from)) {
            return;
        }
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($from, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($iterator as $item) {
            $target = $to . substr($item->getPathname(), strlen($from));
            if ($item->isDir()) {
                if (!is_dir($target)) {
                    mkdir($target, 0775, true);
                }
            } else {
                copy($item->getPathname(), $target);
            }
        }
    }

    private function removeTree(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $item) {
            if ($item->isDir()) {
                rmdir($item->getPathname());
            } else {
                unlink($item->getPathname());
            }
        }
        rmdir($dir);
    }

    /**
     * @return resource
     */
    private function lock(string $dir)
    {
        $handle = fopen($dir . '/lock', 'c');
        if ($handle === false || !flock($handle, LOCK_EX)) {
            throw new TepuyHostException('invalid', 'Package lock was not acquired.');
        }
        return $handle;
    }

    /**
     * @param resource $handle Lock handle.
     */
    private function unlock($handle): void
    {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}
