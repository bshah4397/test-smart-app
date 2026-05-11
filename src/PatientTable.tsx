import {
  getPatientDisplayRows,
  type PatientSummary
} from "./patientSummary";

type PatientTableProps = {
  summary: PatientSummary;
};

export function PatientTable({ summary }: PatientTableProps) {
  return (
    <table className="patient-table" aria-label="Patient context">
      <tbody>
        {getPatientDisplayRows(summary).map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
