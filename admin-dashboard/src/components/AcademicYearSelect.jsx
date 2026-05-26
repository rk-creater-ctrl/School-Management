import { getAcademicYearOptions, normalizeAcademicYear } from "../utils/academicYear";

function AcademicYearSelect({
  className = "field",
  label = "Academic year",
  onChange,
  selectClassName,
  selectStyle,
  value,
  ...selectProps
}) {
  const normalizedValue = normalizeAcademicYear(value);
  const options = getAcademicYearOptions(normalizedValue);

  return (
    <label className={className}>
      {label && <span>{label}</span>}
      <select
        {...selectProps}
        className={selectClassName}
        style={selectStyle}
        value={normalizedValue}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.startYear} value={option.label}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default AcademicYearSelect;
