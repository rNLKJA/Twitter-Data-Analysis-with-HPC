"""
Load the ORIGINAL 2023 coursework modules (coursework/scripts/*) outside of
Spartan, unchanged.

The originals resolve every path against the working directory (data/<file>,
data/result/, doc/log/), parse sys.argv at import time and import mpi4py, so
`load_original()`:

  * builds that directory layout in a temporary sandbox and chdirs into it,
  * symlinks the requested Twitter/sal.json files into sandbox/data/,
  * sets sys.argv to what main.py would receive (`-t <file> -s sal.json`),
  * stubs mpi4py (only `MPI.Get_processor_name()` is used outside main.py),

then imports the modules and returns them.
"""

from __future__ import annotations

import os
import sys
import tempfile
import types
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
COURSEWORK = REPO / "coursework"


def _install_mpi_stub() -> None:
    class _Comm:
        def Get_rank(self):
            return 0

        def Get_size(self):
            return 1

    mpi = types.SimpleNamespace(
        COMM_WORLD=_Comm(), Get_processor_name=lambda: "local-harness"
    )
    pkg = types.ModuleType("mpi4py")
    pkg.MPI = mpi  # type: ignore[attr-defined]
    sys.modules["mpi4py"] = pkg
    sys.modules["mpi4py.MPI"] = mpi  # type: ignore[assignment]


def load_original(sal: Path, twitter: Path | None = None) -> types.SimpleNamespace:
    sal = sal.resolve()
    twitter = twitter.resolve() if twitter else None

    work = Path(tempfile.mkdtemp(prefix="ccc-original-"))
    for sub in ("data/result", "data/processed", "doc/log"):
        (work / sub).mkdir(parents=True)
    os.symlink(sal, work / "data" / "sal.json")
    if twitter:
        os.symlink(twitter, work / "data" / "twitter.json")
    os.chdir(work)

    sys.argv = ["main.py", "-t", "twitter.json", "-s", "sal.json"]
    _install_mpi_stub()
    sys.path.insert(0, str(COURSEWORK))

    from scripts import mpi, sal_processor, twitter_processor, utils  # noqa: E402
    from scripts.logger import twitter_logger  # noqa: E402

    return types.SimpleNamespace(
        workdir=work,
        logger=twitter_logger,
        mpi=mpi,
        sal_processor=sal_processor,
        twitter_processor=twitter_processor,
        utils=utils,
    )


def build_sal_dict(orig: types.SimpleNamespace) -> dict:
    """Exactly what main.py does before starting the timer."""
    sal_df = orig.sal_processor.process_salV1(path=Path(), logger=orig.logger)
    return dict(zip(sal_df["location"].to_list(), sal_df["gcc"].to_list()))
