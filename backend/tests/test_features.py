import json
import os
import sys
import unittest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from ilp_optimizer import ilp_optimizer
from models import DelayInjection, ExtraVisitInput, SimulationRequest, Station, Visit
from optimizer import greedy_optimizer
from simulation_analytics import build_analytics_report, run_simulation


class TrainVisionBackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        data_path = os.path.join(BACKEND_DIR, "data", "trains.json")
        with open(data_path, encoding="utf-8") as f:
            raw = json.load(f)
        cls.stations = [Station(**s) for s in raw["stations"]]
        cls.visits = [Visit(**v) for v in raw["visits"]]

    def test_blocked_platforms_respected_by_both_optimizers(self):
        blocked = {"HWH": [1, 2], "SRC": [1]}
        g_sched, _ = greedy_optimizer(self.visits, self.stations, blocked_platforms=blocked)
        i_sched, _ = ilp_optimizer(self.visits, self.stations, blocked_platforms=blocked)

        for entry in g_sched:
            self.assertNotIn(entry.assigned_platform, blocked.get(entry.station_id, []))
        for entry in i_sched:
            self.assertNotIn(entry.assigned_platform, blocked.get(entry.station_id, []))

    def test_analytics_report_returns_comparison_and_stations(self):
        report = build_analytics_report("ilp", self.visits, self.stations, {})
        self.assertEqual(report.active_algorithm, "ilp")
        self.assertEqual(len(report.comparison), 2)
        algos = {m.algorithm for m in report.comparison}
        self.assertEqual(algos, {"greedy", "ilp"})
        self.assertEqual(len(report.stations), len(self.stations))
        for st in report.stations:
            self.assertGreaterEqual(st.utilization_pct, 0.0)
            self.assertLessEqual(st.utilization_pct, 100.0)
            self.assertEqual(len(st.platforms), st.total_platforms)

    def test_simulation_delay_and_extra_train(self):
        req = SimulationRequest(
            algorithm="ilp",
            blocked_platforms={"HWH": [1]},
            delay_injections=[
                DelayInjection(train_id="T101", station_id="HWH", extra_delay_minutes=20)
            ],
            extra_visits=[
                ExtraVisitInput(
                    train_id="SPL-901",
                    name="Relief Special",
                    type="Special",
                    priority=10,
                    station_id="HWH",
                    scheduled_arrival="08:06",
                    scheduled_departure="08:16",
                    platform_pref=2,
                )
            ],
        )
        res = run_simulation(req, self.visits, self.stations, {})
        self.assertEqual(res.algorithm, "ilp")
        self.assertEqual(len(res.comparison), 2)
        self.assertTrue(any(item.train_id == "T101" for item in res.impacted_trains))
        self.assertTrue(
            any(item.train_id == "SPL-901" and item.is_extra_train for item in res.impacted_trains)
        )
        for e in res.schedule:
            if e.station_id == "HWH":
                self.assertNotEqual(e.assigned_platform, 1)

    def test_simulation_rejects_blocking_all_platforms(self):
        req = SimulationRequest(
            algorithm="greedy",
            blocked_platforms={"SRC": [1, 2, 3, 4]},
        )
        with self.assertRaises(ValueError):
            run_simulation(req, self.visits, self.stations, {})


if __name__ == "__main__":
    unittest.main()
