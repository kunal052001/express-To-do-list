window.onload = gettItems;

const todos = [];

async function gettItems() {
  await axios
    .post("/get-item")
    .then((res) => {
      console.log(res.data.data);
      if (res.data.status !== 200) {
        alert(res.data.message);
        return;
      }
      todos.push(...res.data.data);
    })
    .catch((error) => {
      console.log(error.res.data);
    });

  const todoList = document.getElementById("item_list");
  todoList.style.padding = "0";

  todos.map((todo) => {
    const li = document.createElement("li");
    li.className = "bg-light  rounded-3 p-3 mb-2 text-dark list-group-item list-group-item-action d-flex align-items-center justify-content-between";
    li.innerHTML = `
        <span class="item-text">${todo.todo}</span>
        <div>
            <button data-id="${todo._id}" class="edit-me btn btn-secondary btn-sm mr-1">Edit</button>
            <button data-id="${todo._id}" class="delete-me btn btn-danger btn-sm">Delete</button>
        </div>
    `;
    todoList.appendChild(li);
  });

  document.querySelectorAll(".delete-me").forEach((button) => {
    button.addEventListener("click", (e) => {
      const parent = e.target.parentElement.parentElement;
      const todoId = e.target.getAttribute("data-id");
      if (confirm("Are you sure?")) {
        axios
          .post("/delete-item", { todoId })
          .then((res) => {
            console.log(res.data);
            if (res.data.status !== 200) {
              alert(res.data.message);
              return;
            }
            parent.remove();
          })
          .catch((error) => {
            console.log(error.res.data);
          });
      }
    });
  });

  document.querySelectorAll(".edit-me").forEach((button) => {
    button.addEventListener("click", (e) => {
      const parent = e.target.parentElement.parentElement;
      const todoId = e.target.getAttribute("data-id");
      const newData = prompt("Enter new data", parent.querySelector(".item-text").textContent);
      if (newData.length >= 3) {
        axios
          .post("/update-item", { todoId, newData })
          .then((res) => {
            console.log(res.data);
            if (res.data.status !== 200) {
              alert(res.data.message);
              return;
            }
            parent.querySelector(".item-text").textContent = newData;
          })
          .catch((error) => {
            console.log(error.res.data);
          });
      } else {
        alert("Data should be at least 3 characters long");
      }
    });
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      document.getElementById("add_item").click();
    }
  });

  document.getElementById("add_item").addEventListener("click", (e) => {
    let todo = document.getElementById("create_field").value.trim();
    console.log("todo", todo);
    axios
      .post("/create-item", { todo })
      .then((res) => {
        if (res.data.status !== 201) {
          alert(res.data.message);
          return;
        }
        document.getElementById("create_field").value = "";

        const li = document.createElement("li");
        li.className = "bg-light  rounded-3 p-3 mb-2 text-dark list-group-item list-group-item-action d-flex align-items-center justify-content-between";
        li.innerHTML = `
            <span class="item-text">${res.data.data.todo}</span>
            <div>
                <button data-id="${res.data.data._id}" class="edit-me btn btn-secondary btn-sm mr-1">Edit</button>
                <button data-id="${res.data.data._id}" class="delete-me btn btn-danger btn-sm">Delete</button>
            </div>
        `;
        todoList.appendChild(li);
      })
      .catch((error) => {
        console.log(error);
      });
  });
}
