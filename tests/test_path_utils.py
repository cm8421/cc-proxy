from cc_proxy.path_utils import encode_project_path, decode_project_dir


def test_encode_simple():
    assert encode_project_path("/Users/chenming/projects/cc-proxy") == "-Users-chenming-projects-cc-proxy"


def test_encode_root():
    assert encode_project_path("/Users/test") == "-Users-test"


def test_encode_is_reliable():
    """Encoding path -> dir name is always reliable (one direction only)."""
    path = "/Users/chenming/projects/cc-proxy"
    assert encode_project_path(path) == "-Users-chenming-projects-cc-proxy"


def test_decode_approximate():
    """Decoding is lossy for paths with dashes — use session cwd instead."""
    decoded = decode_project_dir("-Users-chenming-bin")
    assert decoded == "/Users/chenming/bin"
