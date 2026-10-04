from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box
from rich.text import Text

console = Console()


def render_header(report):
    title = Text()
    title.append("◈ GROUND STATION", style="bold cyan")
    title.append(f"  —  {report['ground_station']['name'].upper()}", style="white")
    subtitle = f"[dim]{report['generated_at']} UTC[/dim]"
    console.print(Panel(f"{title}\n{subtitle}", box=box.DOUBLE, style="cyan"))
    for warning in report["warnings"]:
        console.print(f"Warning: {warning}", style="yellow", markup=False)


def render_position(report):
    pos = report["position"]

    # Elevation colour — green if visible, red if not
    if pos["elevation"] >= report["min_elevation"]:
        elev_style = "bold green"
        status_icon = "● ABOVE THRESHOLD"
    elif pos["elevation"] >= 0:
        elev_style = "bold yellow"
        status_icon = "◐ LOW"
    else:
        elev_style = "bold red"
        status_icon = "○ BELOW HORIZON"

    lines = [
        f"[bold white]{report['satellite']}[/bold white]",
        f"  Lat  [cyan]{abs(pos['lat']):.4f}°[/cyan] {pos['lat_dir']}   "
        f"Lon  [cyan]{abs(pos['lon']):.4f}°[/cyan] {pos['lon_dir']}",
        f"  Surface distance [cyan]{pos['distance']:.0f} km[/cyan]",
        f"  Slant range      [cyan]{pos['slant_range_km']:.0f} km[/cyan]",
        f"  Threshold        [cyan]{report['min_elevation']:g}°[/cyan]",
        f"  Bearing    [cyan]{pos['bearing']:.1f}°[/cyan] ({pos['direction']})",
        f"  Elevation  [{elev_style}]{pos['elevation']:.1f}°  {status_icon}[/{elev_style}]",
    ]

    console.print(Panel("\n".join(lines), title="Current Position", box=box.SIMPLE_HEAVY, style="dim white"))


def render_passes(report):
    table = Table(box=box.SIMPLE_HEAVY, show_header=True, header_style="bold cyan")
    table.add_column("#",       width=3,  justify="right")
    table.add_column("AOS (UTC)", width=19)
    table.add_column("Duration", width=10, justify="right")
    table.add_column("Max El",   width=8,  justify="right")
    table.add_column("Quality",  width=18)

    for i, p in enumerate(report["passes"]):
        is_next = (
            report["next_pass"] is not None and
            p["aos"] == report["next_pass"]["aos"]
        )

        if is_next:
            row_style = "bold white"
            num = f"[bold yellow]→ {i+1}[/bold yellow]"
        else:
            row_style = "dim"
            num = str(i + 1)

        if "EXCELLENT" in p["quality"]:
            q_style = "bold green"
        elif "GOOD" in p["quality"]:
            q_style = "bold cyan"
        else:
            q_style = "dim white"

        table.add_row(
            num,
            p["aos"],
            f"{p['duration']}s",
            f"{p['max_elevation']:.1f}°",
            f"[{q_style}]{p['quality']}[/{q_style}]",
            style=row_style,
        )

    console.print(Panel(table, title=f"Passes — next {report['hours']}h", box=box.SIMPLE_HEAVY, style="dim white"))


def render_next_pass(report):
    next_pass_in = report["next_pass_in"]
    next_pass  = report["next_pass"]

    if next_pass_in is None or next_pass is None:
        console.print("[dim]No upcoming passes found.[/dim]")
        return

    countdown = f"[bold yellow]{next_pass_in['hours']}h {next_pass_in['mins']}m[/bold yellow]"
    line = (
        f"Next pass in {countdown}  —  "
        f"AOS [cyan]{next_pass['aos']}[/cyan]  "
        f"MaxEl [cyan]{next_pass['max_elevation']:.1f}°[/cyan]  "
        f"{next_pass['quality']}"
    )
    console.print(Panel(line, box=box.SIMPLE_HEAVY, style="dim white"))


def render_report(report):
    console.clear()
    render_header(report)
    render_position(report)
    render_passes(report)
    render_next_pass(report)

def render_comparison(results, satellite, hours):

    console.print()
    console.print(Panel(
        f"[bold cyan]{satellite}[/bold cyan]  —  Pass Comparison  —  next {hours}h",
        box=box.DOUBLE, style="cyan"
    ))

    table = Table(box=box.SIMPLE_HEAVY, show_header=True,
                  header_style="bold cyan", show_lines=False)

    table.add_column("Station",       width=22)
    table.add_column("Passes",        width=8,  justify="center")
    table.add_column("Best El",       width=10, justify="right")
    table.add_column("Quality",       width=16)
    table.add_column("Total Pass Time", width=16, justify="right")
    table.add_column("Next Pass In",  width=12, justify="right")

    # Sort by best elevation — best station first
    sorted_results = sorted(results,
                            key=lambda r: r["best_elevation"],
                            reverse=True)

    for i, r in enumerate(sorted_results):
        # Colour best station differently
        if i == 0:
            row_style = "bold white"
            rank = "★ "
        else:
            row_style = "dim white"
            rank = "  "

        el = r["best_elevation"]
        if el > 45:
            el_style = "bold green"
        elif el > 20:
            el_style = "bold cyan"
        else:
            el_style = "dim white"

        mins = r["total_pass_seconds"] // 60
        secs = r["total_pass_seconds"] % 60
        duration_str = f"{mins}m {secs}s"

        table.add_row(
            f"{rank}{r['station']}",
            str(r["passes"]),
            f"[{el_style}]{el:.1f}°[/{el_style}]",
            r["best_quality"],
            duration_str,
            r["next_pass"],
            style=row_style,
        )

    console.print(table)
    console.print()
