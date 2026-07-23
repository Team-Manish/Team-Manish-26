import { useState } from "react";
 
function StudentForm({ setStudent }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    course: "",
  });
 
  const handleChange = (event) => {
    const { name, value } = event.target;
 
    setFormData({
      ...formData,
      [name]: value,
    });
  };
 
  const handleSubmit = (event) => {
    event.preventDefault();
 
    setStudent(formData);
 
    setFormData({
      name: "",
      email: "",
      course: "",
    });
  };
 
  return (
    <form onSubmit={handleSubmit}>
 
      <label>Name</label>
      <input
        type="text"
        name="name"
        value={formData.name}
        onChange={handleChange}
        required
      />
 
      <label>Email</label>
      <input
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        required
      />
 
      <label>Course</label>
      <input
        type="text"
        name="course"
        value={formData.course}
        onChange={handleChange}
        required
      />
 
   
 
      <button type="submit">Sign Up</button>
 
    </form>
  );
}
 
export default StudentForm;