<?php
/**
 * HTTP front for the Tepuy test host.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

declare(strict_types=1);

require dirname(__DIR__, 2) . '/host/src/Store.php';

$config = require dirname(__DIR__, 2) . '/host/config.php';
$store = new TepuyStore(
    $config['root'],
    $config['user'],
    (int) $config['maxBytes'],
    (int) $config['retentionDays']
);

$token = (string) ($_SERVER['HTTP_X_TEPUY_TOKEN'] ?? '');
if ($token === '' && str_starts_with((string) ($_SERVER['HTTP_AUTHORIZATION'] ?? ''), 'Bearer ')) {
    $token = substr((string) $_SERVER['HTTP_AUTHORIZATION'], 7);
}
if (!hash_equals((string) $config['token'], $token)) {
    respond(['error' => 'forbidden', 'message' => 'Token rejected.'], 403);
}

$action = (string) ($_GET['action'] ?? '');

try {
    switch ($action) {
        case 'capabilities':
            respond($store->capabilities());
        case 'getUser':
            respond($store->getUser());
        case 'create':
            $body = jsonBody();
            respond($store->create((string) ($body['name'] ?? ''), (string) ($body['themeId'] ?? 'base')));
        case 'open':
            respond($store->open((string) ($_GET['ref'] ?? '')));
        case 'listPackages':
            respond(['packages' => $store->listPackages()]);
        case 'list':
            respond(['files' => $store->listFiles((string) ($_GET['ref'] ?? ''))]);
        case 'read':
            respond($store->read((string) ($_GET['ref'] ?? ''), (string) ($_GET['path'] ?? '')));
        case 'commit':
            $body = jsonBody();
            $changes = $body['changes'] ?? [];
            respond($store->commit(
                (string) ($body['ref'] ?? ''),
                is_array($changes) ? $changes : [],
                (string) ($body['baseRevision'] ?? '')
            ));
        case 'tempUpload':
            $file = $_FILES['file'] ?? null;
            if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                throw new TepuyHostException('invalid', 'Upload rejected.');
            }
            $bytes = file_get_contents((string) $file['tmp_name']);
            if ($bytes === false) {
                throw new TepuyHostException('invalid', 'Upload rejected.');
            }
            respond($store->tempUpload((string) ($_GET['ref'] ?? ''), (string) $file['name'], $bytes));
        case 'download':
            $ref = (string) ($_GET['ref'] ?? '');
            $bytes = $store->download($ref);
            header('Content-Type: application/zip');
            header('Content-Disposition: attachment; filename="' . $ref . '.zip"');
            header('Content-Length: ' . strlen($bytes));
            echo $bytes;
            exit;
        case 'appendLog':
            $body = jsonBody();
            $entries = $body['entries'] ?? [];
            $store->appendLog((string) ($body['ref'] ?? ''), is_array($entries) ? $entries : []);
            respond(['ok' => true]);
        case 'listLog':
            respond(['entries' => $store->listLog((string) ($_GET['ref'] ?? ''), [
                'user' => (string) ($_GET['user'] ?? ''),
                'operation' => (string) ($_GET['operation'] ?? ''),
                'from' => (string) ($_GET['from'] ?? ''),
                'to' => (string) ($_GET['to'] ?? ''),
            ])]);
        default:
            throw new TepuyHostException('invalid', 'Action rejected.');
    }
} catch (TepuyHostException $error) {
    $status = match ($error->error) {
        'conflict' => 409,
        'forbidden' => 403,
        'not_found' => 404,
        'too_large' => 413,
        default => 400,
    };
    respond(['error' => $error->error, 'message' => $error->getMessage()], $status);
}

/**
 * @return array<string, mixed> JSON request body.
 */
function jsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new TepuyHostException('invalid', 'Request body rejected.');
    }
    return $data;
}

/**
 * @param array<string, mixed> $data Response payload.
 */
function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
