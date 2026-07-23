function StudentCard({ student }) {
  return (
    <div className="card">
 
      <h2>Student Details</h2>
 
      <p>
        <strong>Name:</strong> {student.name}
      </p>
 
      <p>
        <strong>Email:</strong> {student.email}
      </p>
 
      <p>
        <strong>Course:</strong> {student.course}
      </p>
 
    </div>
  );
}
 
export default StudentCard;