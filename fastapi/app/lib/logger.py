import logging
import sys

from pythonjsonlogger import jsonlogger as JsonFormatter


def _build_logger() -> logging.Logger:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter.JsonFormatter('%(asctime)s %(name)s %(levelname)s %(message)s'))
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    if not root.handlers:
        root.addHandler(handler)
    return logging.getLogger('linkshrtr')


logger = _build_logger()
