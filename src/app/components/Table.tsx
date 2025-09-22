interface TableProps {
  data: string[][];
}

export default function Table({ data }: TableProps) {
  if (!data.length) return null;

  return (
    <table className="min-w-full border-collapse mt-4">
      <thead>
        <tr>
          {data[0].map((header, idx) => (
            <th key={idx} className="border p-2 bg-gray-200">{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.slice(1).map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className="border p-2">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
