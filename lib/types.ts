export type PassFail = "Pass" | "Fail";
export type OkNg = "OK" | "NG";

export interface Worker {
  id: string;
  name: string;
  emp_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DailyWorkerInspection {
  id: string;
  inspection_date: string;
  worker_id: string | null;
  worker_name: string;
  esd_result: PassFail | null;
  wrist_result: PassFail | null;
  tool_id: string | null;
  torque_1: number | null;
  torque_2: number | null;
  torque_3: number | null;
  torque_result: PassFail | null;
  remarks: string | null;
  created_at: string;
}

export interface DailyHipotInspection {
  id: string;
  inspection_date: string;
  inspector: string | null;
  pass_sample_result: PassFail | null;
  fail_sample_result: PassFail | null;
  overall_result: PassFail | null;
  remarks: string | null;
  created_at: string;
}

export interface MonthlyInspection {
  id: string;
  period: string;
  inspector: string | null;
  load_pass_value: number | null;
  load_pass_result: PassFail | null;
  load_fail_value: number | null;
  load_fail_result: PassFail | null;
  gloves_open_date: string | null;
  gloves_expiry: string | null;
  gloves_result: PassFail | null;
  mv_fixture1_serial: string | null;
  mv_fixture1_check1: OkNg | null;
  mv_fixture1_check2: OkNg | null;
  mv_fixture1_result: PassFail | null;
  mv_fixture2_serial: string | null;
  mv_fixture2_check1: OkNg | null;
  mv_fixture2_check2: OkNg | null;
  mv_fixture2_result: PassFail | null;
  mv_fixture3_serial: string | null;
  mv_fixture3_check1: OkNg | null;
  mv_fixture3_check2: OkNg | null;
  mv_fixture3_result: PassFail | null;
  mv_fixture_remarks: string | null;
  mv_tray_serial: string | null;
  mv_tray_check1: OkNg | null;
  mv_tray_check2: OkNg | null;
  mv_tray_result: PassFail | null;
  mv_tray_remarks: string | null;
  overall_result: PassFail | null;
  remarks: string | null;
  created_at: string;
}

export interface BiyearlyInspection {
  id: string;
  period: string;
  inspector: string | null;
  surface_1_id: string | null; surface_1_value: string | null; surface_1_result: PassFail | null;
  surface_2_id: string | null; surface_2_value: string | null; surface_2_result: PassFail | null;
  surface_3_id: string | null; surface_3_value: string | null; surface_3_result: PassFail | null;
  surface_4_id: string | null; surface_4_value: string | null; surface_4_result: PassFail | null;
  surface_5_id: string | null; surface_5_value: string | null; surface_5_result: PassFail | null;
  wrist_1_id: string | null; wrist_1_value: string | null; wrist_1_result: PassFail | null;
  wrist_2_id: string | null; wrist_2_value: string | null; wrist_2_result: PassFail | null;
  wrist_3_id: string | null; wrist_3_value: string | null; wrist_3_result: PassFail | null;
  wrist_4_id: string | null; wrist_4_value: string | null; wrist_4_result: PassFail | null;
  wrist_5_id: string | null; wrist_5_value: string | null; wrist_5_result: PassFail | null;
  overall_result: PassFail | null;
  remarks: string | null;
  created_at: string;
}

export interface VideoConfig {
  key: string;
  url: string;
  updated_at: string;
}

// Supabase Database type
export type Database = {
  public: {
    Tables: {
      workers: { Row: Worker; Insert: Omit<Worker, "id" | "created_at">; Update: Partial<Omit<Worker, "id">> };
      daily_worker_inspections: { Row: DailyWorkerInspection; Insert: Omit<DailyWorkerInspection, "id" | "created_at">; Update: Partial<Omit<DailyWorkerInspection, "id">> };
      daily_hipot_inspections: { Row: DailyHipotInspection; Insert: Omit<DailyHipotInspection, "id" | "created_at">; Update: Partial<Omit<DailyHipotInspection, "id">> };
      monthly_inspections: { Row: MonthlyInspection; Insert: Omit<MonthlyInspection, "id" | "created_at">; Update: Partial<Omit<MonthlyInspection, "id">> };
      biyearly_inspections: { Row: BiyearlyInspection; Insert: Omit<BiyearlyInspection, "id" | "created_at">; Update: Partial<Omit<BiyearlyInspection, "id">> };
      video_configs: { Row: VideoConfig; Insert: VideoConfig; Update: Partial<VideoConfig> };
    };
  };
};
